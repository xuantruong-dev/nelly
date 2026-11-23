import type Database from 'better-sqlite3';
import crypto from 'node:crypto';
import type { ProductAddon, ProductVariant } from '../shared/types.ts';

// Deterministic PRNG (Mulberry32) so seeded activity is 100% reproducible across environments
function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function shuffleInPlace<T>(rng: () => number, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Convert Vietnam local date/time (UTC+7) to SQLite UTC string 'YYYY-MM-DD HH:MM:SS'
function vnToSqliteUtc(
  year: number,
  month: number,
  day: number,
  hourVn: number,
  minuteVn: number,
  secondVn: number
): string {
  const vnMs = Date.UTC(year, month - 1, day, hourVn, minuteVn, secondVn);
  const utc = new Date(vnMs - 7 * 3600 * 1000);
  return (
    `${utc.getUTCFullYear()}-${pad2(utc.getUTCMonth() + 1)}-${pad2(utc.getUTCDate())} ` +
    `${pad2(utc.getUTCHours())}:${pad2(utc.getUTCMinutes())}:${pad2(utc.getUTCSeconds())}`
  );
}

// Add hours to a SQLite UTC timestamp while clamping to <= 2026-11-23 22:30:00 VN time
function addHoursClamped(sqliteUtc: string, addHours: number): string {
  const iso = sqliteUtc.replace(' ', 'T') + 'Z';
  const maxUtcMs = Date.UTC(2026, 10, 23, 22, 30, 0) - 7 * 3600 * 1000;
  const nextMs = Math.min(maxUtcMs, Date.parse(iso) + Math.round(addHours * 3600 * 1000));
  const d = new Date(nextMs);
  return (
    `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ` +
    `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`
  );
}

interface DbProductRow {
  id: number;
  sku: string;
  slug: string;
  name: string;
  category_slug: string;
  pricing_type: string;
  base_price: number | null;
  images_json: string;
  variants_json: string;
  addons_json: string;
}

interface ParsedProduct {
  id: number;
  sku: string;
  slug: string;
  name: string;
  category_slug: string;
  pricing_type: string;
  base_price: number;
  images: string[];
  variants: ProductVariant[];
  addons: ProductAddon[];
}

// Authentic Vietnamese customer data pools
const LAST_NAMES = [
  'Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng',
  'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý', 'Đào', 'Đinh', 'Tạ', 'Trịnh',
  'Mai', 'Lương', 'Trương', 'Châu', 'Kiều', 'Tô', 'Hà', 'Chu', 'Lưu', 'Nghiêm',
];

const FEMALE_MIDDLES = [
  'Thị', 'Ngọc', 'Minh', 'Thanh', 'Thảo', 'Phương', 'Khánh', 'Bảo', 'Gia', 'Quỳnh',
  'Hoàng', 'Hồng', 'Kim', 'Thu', 'Anh', 'Nhật', 'Cẩm', 'Tú', 'Bích', 'Thùy',
];

const FEMALE_FIRSTS = [
  'Anh', 'Linh', 'Trang', 'Hương', 'Lan', 'Vy', 'Nhi', 'Thư', 'Ngân', 'Trâm',
  'Chi', 'Huyền', 'Yến', 'My', 'Tâm', 'Hà', 'Mai', 'Phương', 'Uyên', 'Quỳnh',
  'Hân', 'Châu', 'Oanh', 'Nhung', 'Dung', 'Vân', 'Hiền', 'Thảo', 'Giang', 'Ngọc',
];

const MALE_MIDDLES = [
  'Văn', 'Minh', 'Quốc', 'Đức', 'Gia', 'Hoàng', 'Hữu', 'Thanh', 'Tuấn', 'Quang',
  'Xuân', 'Nhật', 'Trung', 'Tiến', 'Thế', 'Anh', 'Bảo', 'Khánh', 'Duy', 'Công',
];

const MALE_FIRSTS = [
  'Huy', 'Khang', 'Minh', 'Nam', 'Dũng', 'Hùng', 'Tuấn', 'Đạt', 'Long', 'Phong',
  'Quân', 'Khôi', 'Kiên', 'Bình', 'Sơn', 'Thành', 'Tùng', 'Việt', 'Hải', 'Lâm',
];

const PHONE_PREFIXES = [
  '090', '091', '093', '096', '097', '098',
  '032', '034', '035', '036', '038', '039',
  '070', '077', '079', '083', '085', '086', '088',
];

const STREETS = [
  'Nguyễn Trãi', 'Cầu Giấy', 'Xuân Thủy', 'Chùa Bộc', 'Thái Hà', 'Xã Đàn',
  'Kim Mã', 'Đội Cấn', 'Láng Hạ', 'Trần Duy Hưng', 'Tôn Thất Tùng', 'Phạm Ngọc Thạch',
  'Hai Bà Trưng', 'Lý Thường Kiệt', 'Phố Huế', 'Bà Triệu', 'Nguyễn Chí Thanh', 'Hoàng Quốc Việt',
  'Lê Văn Lương', 'Trung Kính', 'Mỹ Đình', 'Hồ Tùng Mậu', 'Trường Chinh', 'Giải Phóng',
  'Nguyễn Văn Cừ', 'Ngọc Lâm', 'Minh Khai', 'Tây Sơn', 'Quang Trung', 'Trần Phú',
];

const DISTRICTS = [
  'Q. Cầu Giấy, Hà Nội', 'Q. Đống Đa, Hà Nội', 'Q. Thanh Xuân, Hà Nội',
  'Q. Ba Đình, Hà Nội', 'Q. Hai Bà Trưng, Hà Nội', 'Q. Hoàn Kiếm, Hà Nội',
  'Q. Nam Từ Liêm, Hà Nội', 'Q. Tây Hồ, Hà Nội', 'Q. Long Biên, Hà Nội', 'Q. Hà Đông, Hà Nội',
];

const TIME_SLOTS = [
  '08:00 - 10:00',
  '10:00 - 12:00',
  '13:30 - 15:30',
  '15:30 - 17:30',
  '17:30 - 19:30',
  '19:30 - 21:00',
];

const CARD_MESSAGES_BY_MONTH: Record<number, string[]> = {
  2: [
    'Happy Valentine! Cảm ơn em vì luôn dịu dàng và đồng hành cùng anh.',
    'Chúc em tuổi mới thật nhiều niềm vui, luôn rạng rỡ như đóa hoa này.',
    'Mừng Valentine ngọt ngào, gửi ngàn yêu thương đến người thương của anh.',
    'Chúc bạn khai xuân thuận lợi, công việc hanh thông cả năm nhé!',
  ],
  3: [
    'Chúc mừng ngày Quốc tế Phụ nữ 8/3! Luôn xinh đẹp, tự tin và hạnh phúc nhé.',
    'Gửi tặng mẹ bó hoa nhỏ nhân ngày 8/3, mong mẹ luôn mạnh khỏe bình an.',
    'Chúc chị em phòng mình 8/3 thật rạng rỡ và tràn đầy năng lượng!',
    'Chúc mừng sinh nhật bạn thân, tuổi mới thật nhiều kỷ niệm đáng nhớ.',
  ],
  5: [
    'Chúc mừng Ngày của Mẹ! Con cảm ơn mẹ luôn yêu thương và chăm lo cho cả nhà.',
    'Chúc em một ngày sinh nhật thật ấm áp và đầy ắp tiếng cười.',
    'Kỷ niệm ngày yêu nhau, cảm ơn vì đã luôn ở bên lắng nghe và sẻ chia.',
    'Mừng khai trương hồng phát, công việc buôn may bán đắt nhé!',
  ],
  6: [
    'Chúc mừng Tân Cử Nhân! Chặng đường mới thật rực rỡ và thành công nhé.',
    'Mừng ngày tốt nghiệp, tự hào về những nỗ lực không ngừng của bạn!',
    'Chúc bé sinh nhật thật vui, hay ăn chóng lớn và luôn ngoan ngoãn nhé.',
    'Chúc em tháng 6 thật nhiều nắng đẹp và những khởi đầu suôn sẻ.',
  ],
  7: [
    'Chúc mừng sinh nhật bạn yêu, tuổi mới thật bình an và rực rỡ nhé!',
    'Cảm ơn bạn đã luôn là người bạn đồng hành tuyệt vời nhất của mình.',
    'Mừng khai trương cửa hàng mới, chúc luôn đông khách và phát đạt!',
    'Gửi tặng em chút sắc màu pastel dịu mát cho ngày hè thêm vui.',
  ],
  8: [
    'Chúc mừng sinh nhật em, mong mọi điều dịu dàng nhất sẽ luôn đến với em.',
    'Kỷ niệm 1 năm về chung một nhà, cảm ơn vì tất cả yêu thương.',
    'Chúc bạn công việc mới thuận lợi và gặt hái thật nhiều thành công!',
    'Tặng cô bạn thân một bó hoa xinh thay lời chúc một tuần thật vui vẻ.',
  ],
  9: [
    'Chúc mừng năm học mới thật nhiều hứng khởi và thành tích thật tốt nhé!',
    'Chúc gia đình mùa Trung Thu đoàn viên ấm áp và ngập tràn niềm vui.',
    'Chúc mừng sinh nhật người thương, cảm ơn vì đã mang nắng đến bên anh.',
    'Mừng khai trương hồng phát, vạn sự hanh thông nhé!',
  ],
  10: [
    'Chúc mừng 20/10 thật rạng rỡ và luôn hạnh phúc nhé!',
    'Mừng ngày Phụ nữ Việt Nam 20/10, gửi ngàn yêu thương đến mẹ và chị.',
    'Chúc em sinh nhật tuổi mới thật nhiều niềm vui và may mắn.',
    'Chúc cô bạn thân 20/10 luôn xinh đẹp, rạng rỡ mỗi ngày!',
    'Kỷ niệm ngày quen nhau, cảm ơn vì đã luôn ở bên anh.',
  ],
  11: [
    'Tri ân thầy cô nhân ngày 20/11, kính chúc thầy cô thật nhiều sức khỏe!',
    'Chúc mừng ngày Nhà giáo Việt Nam 20/11, cảm ơn cô đã luôn tận tâm.',
    'Gửi tặng cô giáo chủ nhiệm bó hoa nhỏ thay lời cảm ơn chân thành.',
    'Chúc mừng sinh nhật bạn yêu, tuổi mới thật rực rỡ nhé!',
    'Mừng khai trương hồng phát, buôn may bán đắt nhé!',
  ],
};

const ORDER_CUSTOMER_NOTES = [
  'Nhờ shop thắt nơ chắc tay giúp mình nhé.',
  'Gọi trước cho người nhận 15 phút trước khi giao giúp em.',
  'Ghi thiệp chữ nắn nót giúp mình, cảm ơn shop nhiều!',
  'Bọc túi cẩn thận tránh bị xước bóng khi ship ạ.',
  'Mình ghé cửa hàng lấy đúng khung giờ đã chọn nha.',
  'Nhờ shop chọn tông pastel dịu nhẹ như ảnh mẫu.',
  'Tặng bất ngờ nên không để lộ giá trên hóa đơn giúp mình.',
  'Nếu màu hồng phấn hết thì đổi sang đào kem giúp em nhé.',
  '', '', '', '',
];

const CANCEL_REASONS = [
  'Khách thay đổi lịch tiệc sang tháng sau, hẹn đặt lại sau.',
  'Khách chọn nhầm màu và đã tạo lại đơn mới.',
  'Khách đi công tác đột xuất không nhận được đúng khung giờ.',
  'Khách đổi sang gói trang trí sự kiện trọn gói thay vì đặt lẻ.',
];

function makeCustomer(rng: () => number): { name: string; displayName: string; phone: string; email: string } {
  const isFemale = rng() < 0.72;
  const last = pick(rng, LAST_NAMES);
  const mid = isFemale ? pick(rng, FEMALE_MIDDLES) : pick(rng, MALE_MIDDLES);
  const first = isFemale ? pick(rng, FEMALE_FIRSTS) : pick(rng, MALE_FIRSTS);
  const fullName = `${last} ${mid} ${first}`;
  const displayName = rng() < 0.55 ? `${mid} ${first}` : `${last} ${first}`;
  const phone = `${pick(rng, PHONE_PREFIXES)}${String(randInt(rng, 1000000, 9999999))}`;
  const slug = `${first}${last}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
  const email = rng() < 0.45 ? `${slug}${randInt(rng, 12, 98)}@gmail.com` : '';
  return { name: fullName, displayName, phone, email };
}

function makeAddress(rng: () => number): string {
  const num = randInt(rng, 12, 368);
  const alley = rng() < 0.35 ? `Ngõ ${randInt(rng, 5, 142)} ` : '';
  return `Số ${num}, ${alley}${pick(rng, STREETS)}, ${pick(rng, DISTRICTS)}`;
}

// Realistic Vietnamese review fragments assembled with rich variety
const REVIEW_OPENERS_5 = [
  'Nhận hoa mà bất ngờ luôn, bên ngoài còn xinh hơn cả ảnh mẫu.',
  'Đặt tặng dịp lễ mà ai nhận cũng khen nức nở vì quá dễ thương.',
  'Mình đặt lần thứ hai ở Hoa Nelly rồi, lần nào cũng ưng tuyệt đối.',
  'Shop làm rất có tâm, từ phom hoa đến chiếc nơ đều cân đối, tỉ mỉ.',
  'Giao đúng giờ hẹn, hoa đóng gói kỹ nên đến nơi vẫn căng tròn nguyên vẹn.',
  'Màu pastel dịu mắt lắm, chụp ảnh dưới ánh sáng tự nhiên lên hình cực xinh.',
  'Tư vấn nhiệt tình, mình nhờ đổi nhẹ tông nơ và viết thiệp shop đều hỗ trợ chu đáo.',
  'Đặt gấp trong ngày cho kịp tiệc sinh nhật mà shop vẫn chuẩn bị kịp và rất đẹp.',
  'Hoa bóng bay giữ form lâu thật sự, để phòng máy lạnh cả tuần vẫn chưa xì.',
  'Bạn mình nhận quà cười tít mắt, cứ hỏi địa chỉ tiệm hoa hoài.',
  'Giá hợp lý mà chất lượng hoàn thiện cao hơn hẳn mấy chỗ mình từng mua.',
  'Chủ tiệm dễ thương, gửi ảnh chụp thành phẩm cho xem trước khi giao nên rất yên tâm.',
  'Ghé shop lấy trực tiếp, hoa đã buộc nơ sẵn gọn gàng và chỉn chu lắm.',
  'Cả lớp đặt tặng cô dịp 20/11, cô thích lắm vì trưng bàn làm việc được nhiều ngày.',
  'Lần đầu mua hoa bóng bay tặng mẹ ngày lễ, mẹ khen sáng tạo mà bền đẹp.',
  'Đặt tặng bạn lễ tốt nghiệp, cầm lên sân khấu chụp ảnh nổi bật cả góc trường luôn.',
];

const REVIEW_DETAILS_5 = [
  'Bóng dày dặn, không có mùi cao su hắc và màu lên rất mịn.',
  'Thiệp viết tay chữ đẹp, nơ ruy băng buộc khéo nên tổng thể nhìn rất sang.',
  'Shipper giao cẩn thận, gọi trước 15 phút nên nhận hàng rất thuận tiện.',
  'Mình chụp ảnh kỷ niệm cả buổi mà dáng hoa vẫn chắc chắn, không bị lỏng cuống.',
  'Đặt cho sinh nhật bé ở nhà, các bé thích mê cứ ôm chụp ảnh mãi.',
  'Màu sắc đúng chuẩn bảng pastel Hàn Quốc, không bị chói hay lệch tông.',
  'Phần gói giấy và túi trong suốt rất sạch đẹp, xách đi tặng lịch sự lắm.',
  'So với hoa tươi nhanh tàn thì hoa bóng bay này trưng được lâu hơn nhiều mà vẫn độc đáo.',
  'Mọi chi tiết nhỏ như nhụy hoa, lá xanh đều được làm rất đều tay.',
  'Chắc chắn sẽ còn quay lại ủng hộ Hoa Nelly trong những dịp sắp tới.',
];

const REVIEW_COMMENTS_4 = [
  'Hoa làm rất đẹp và đúng màu mình chọn, chỉ có shipper đến trễ khoảng 15 phút do giờ tan tầm nhưng vẫn kịp tặng. Rất ưng chất lượng hoa của shop!',
  'Dáng hoa xinh, bóng dày và giữ form tốt. Mình góp ý nhẹ là shop làm thêm nhiều mẫu thiệp viết tay mới nữa cho đa dạng nhé.',
  'Đặt hoa lẻ cầm tay tặng nhóm bạn dịp lễ, mọi người đều khen dễ thương. Một bông có nơ hơi lỏng nhẹ nhưng tự chỉnh lại là đẹp ngay.',
  'Sản phẩm giống mô tả, màu pastel nhẹ nhàng đúng gu mình thích. Giờ cao điểm dịp lễ shop hơi đông nên phản hồi tin nhắn chậm một chút, bù lại hoa rất chỉn chu.',
  'Hoa đẹp, giá phải chăng, trưng bàn làm việc 4 ngày vẫn căng tròn. Mong shop mở thêm nhiều khung giờ giao tối muộn hơn.',
  'Gói quà cẩn thận, thiệp ghi đúng lời nhắn mình dặn. Chỉ tiếc mẫu màu tím oải hương hôm đó hết nên phải đổi sang hồng phấn, nhưng hồng phấn cũng rất xinh.',
  'Chất lượng tốt trong tầm giá, nhân viên tư vấn nhẹ nhàng. Nếu có thêm tùy chọn gói giấy bóng kính chống bụi miễn phí thì tuyệt vời hơn nữa.',
  'Tặng cô giáo ai cũng thích vì mới lạ. Lúc nhận hơi sát giờ vào lớp nhưng may vẫn kịp, cảm ơn Hoa Nelly đã hỗ trợ gấp.',
];

const REVIEW_COMMENTS_3 = [
  'Hoa nhìn chung ổn và khá xinh, tuy nhiên hôm cao điểm lễ đơn đông nên giao trễ hơn khung giờ hẹn gần 30 phút làm mình hơi sốt ruột. Hy vọng dịp lễ sau shop sắp xếp giao sớm hơn.',
  'Màu thực tế hơi nhạt hơn một chút so với ảnh chụp studio nhưng vẫn dễ thương. Bóng giữ được khoảng 3 ngày trong phòng hơi nóng.',
  'Bó mini gọn xinh, hợp tặng nhanh, nhưng mình kỳ vọng kích thước bông lớn hơn một chút. Shop phản hồi hỗ trợ nhanh và lịch sự.',
];

const SHOP_REPLIES_5 = [
  'Hoa Nelly cảm ơn bạn thật nhiều vì đã tin tưởng và dành lời khen ngọt ngào cho tiệm ạ! Rất mong lại được đồng hành cùng bạn trong những dịp đặc biệt sắp tới.',
  'Cảm ơn bạn đã chia sẻ cảm nhận và ảnh xinh cùng Hoa Nelly nhé! Niềm vui của người nhận luôn là động lực lớn nhất để tiệm chăm chút từng bông hoa mỗi ngày.',
  'Hoa Nelly rất vui khi bạn hài lòng từ dáng hoa đến dịch vụ giao nhận. Hẹn gặp lại bạn ở những món quà thật xinh tiếp theo ạ!',
  'Cảm ơn bạn đã ủng hộ Hoa Nelly! Chúc bạn và người thương luôn nhiều niềm vui và thật nhiều khoảnh khắc đáng nhớ.',
  'Nhận được đánh giá 5 sao của bạn cả tiệm vui lắm luôn ạ! Hoa Nelly sẽ luôn giữ vững sự chỉn chu trong từng chi tiết nhỏ nhất.',
  'Cảm ơn bạn đã quay lại ủng hộ tiệm lần nữa nhé! Bất cứ khi nào cần phối màu riêng hay thiết kế mẫu mới, cứ nhắn Hoa Nelly hỗ trợ nha.',
];

const SHOP_REPLIES_4 = [
  'Hoa Nelly cảm ơn bạn đã tin yêu và góp ý rất chân thành ạ! Tiệm đã ghi nhận để tối ưu khung giờ giao cao điểm và bổ sung thêm nhiều lựa chọn mới phục vụ bạn tốt hơn lần sau.',
  'Cảm ơn bạn đã ủng hộ Hoa Nelly và chia sẻ đánh giá 4 sao quý giá! Tiệm xin rút kinh nghiệm về thời gian phản hồi giờ cao điểm để trải nghiệm lần tới của bạn thật trọn vẹn 5 sao ạ.',
  'Hoa Nelly rất trân trọng phản hồi của bạn! Tiệm đã bổ sung thêm mẫu thiệp và kiểm tra kỹ phần nơ trước khi xuất đơn, hẹn được phục vụ bạn chu đáo hơn nữa nhé.',
];

const SHOP_REPLIES_3 = [
  'Hoa Nelly chân thành xin lỗi bạn vì trải nghiệm giao hàng/sản phẩm chưa thật sự trọn vẹn trong đợt cao điểm vừa qua. Tiệm đã điều chỉnh lại quy trình điều phối ship giờ lễ và ghi chú kỹ kích thước thực tế hơn. Cảm ơn bạn đã góp ý thẳng thắn để Hoa Nelly hoàn thiện hơn ạ!',
  'Cảm ơn bạn đã phản hồi trung thực giúp Hoa Nelly cải thiện dịch vụ. Với thời tiết nóng, tiệm luôn khuyến nghị đặt hoa trong phòng mát để giữ dáng lâu nhất; lần đặt tới bạn nhắn tiệm để Hoa Nelly hỗ trợ ưu đãi nhỏ như lời cảm ơn nhé!',
];

const STAFF_REPLY_NAMES = ['Hoa Nelly · CSKH Minh Anh', 'Chủ cửa hàng Hoa Nelly', 'Hoa Nelly · Tư vấn Thu Hà'];

// 24 comprehensive, authentic product Q&A templates — 100% pre-answered!
const QA_TEMPLATES: { q: string; a: string }[] = [
  {
    q: 'Mẫu này giữ form đẹp được khoảng bao nhiêu ngày ạ? Mình muốn đặt trước 1 ngày cho tiệc sáng hôm sau.',
    a: 'Dạ hoa bóng bay của Hoa Nelly dùng bóng cao su dày cao cấp nên giữ form căng đẹp từ 4–7 ngày trong phòng mát (tránh nắng trực tiếp và vật sắc nhọn). Bạn đặt lấy trước 1 tối để sáng hôm sau tặng vẫn hoàn toàn căng bóng như mới ạ!',
  },
  {
    q: 'Shop có hỗ trợ đổi màu nơ sang màu trắng kem hoặc hồng phấn theo yêu cầu không?',
    a: 'Dạ có ạ! Hoa Nelly hỗ trợ đổi màu nơ và điều chỉnh sắc độ pastel hoàn toàn miễn phí. Bạn chỉ cần ghi rõ ở mục "Ghi chú thêm cho cửa hàng" khi đặt đơn hoặc nhắn trực tiếp cho tiệm nha.',
  },
  {
    q: 'Mình cần giao gấp trong ngày ở khu vực Cầu Giấy thì đặt trước mấy tiếng ạ?',
    a: 'Với hoa lẻ và phụ kiện có sẵn, tiệm chuẩn bị và giao trong khoảng 1–2 giờ. Với bó hoa thiết kế/tạo hình nhân vật, bạn giúp tiệm đặt trước 8–18 giờ (hoặc gọi hotline 0376434207 để tiệm ưu tiên sắp xếp đơn gấp nhé).',
  },
  {
    q: 'Mình muốn gửi tặng bất ngờ cho người thương, shop có giấu giá trên phiếu giao và viết thiệp hộ không?',
    a: 'Dạ chắc chắn có ạ! Ở bước đặt hàng bạn chỉ cần tích chọn "Quà tặng – không hiển thị giá cho người nhận" và điền lời chúc, Hoa Nelly sẽ viết thiệp nắn nót và giữ bí mật hoàn toàn giá đơn hàng ạ.',
  },
  {
    q: 'Mẫu này có bán kèm túi trong suốt để mang đi xe máy không bị xước bóng không shop?',
    a: 'Dạ có nha bạn! Bạn có thể chọn thêm phụ kiện túi kính trong suốt cỡ phù hợp ngay trên trang sản phẩm, vừa giúp bảo vệ bóng khi di chuyển bằng xe máy vừa tăng độ lịch sự khi trao tặng ạ.',
  },
  {
    q: 'Đặt số lượng từ 15–20 bông hoa lẻ tặng lớp dịp lễ có được giảm giá hoặc miễn phí ship không ạ?',
    a: 'Dạ đơn nhóm/lớp từ 15 sản phẩm trở lên Hoa Nelly luôn có chính sách chiết khấu riêng và hỗ trợ phí giao nội thành. Bạn để lại thông tin ở mục Liên hệ hoặc nhắn Zalo hotline 0376434207 để tiệm gửi báo giá ưu đãi ngay nhé!',
  },
  {
    q: 'Mình muốn ghé trực tiếp cửa hàng để tự chọn màu và mang về có được không?',
    a: 'Dạ hoàn toàn được ạ! Hoa Nelly mở cửa từ 7:00 – 23:00 mỗi ngày. Bạn có thể chọn phương thức "Nhận tại cửa hàng" khi đặt đơn để tiệm chuẩn bị sẵn đúng giờ bạn ghé lấy, không phải chờ lâu nha.',
  },
  {
    q: 'Tạo hình nhân vật chibi có làm theo ảnh thật của người nhận (kiểu tóc, kính, áo tốt nghiệp) được không shop?',
    a: 'Dạ được ạ! Bạn có thể tải ảnh tham khảo trực tiếp ngay tại trang sản phẩm hoặc mục "Đặt thiết kế riêng". Thợ tạo hình bên tiệm sẽ căn chỉnh kiểu tóc, phụ kiện kính, màu áo và gửi ảnh thành phẩm duyệt trước khi giao ạ.',
  },
  {
    q: 'Nếu tổ chức tiệc sinh nhật ngoài trời buổi chiều thì bóng có nhanh bị mềm không ạ?',
    a: 'Với tiệc ngoài trời, Hoa Nelly sẽ sử dụng dòng bóng chuyên dụng dày hơn và tư vấn đặt khu vực râm mát hoặc lắp sát giờ khai tiệc để cụm bóng luôn căng bóng, lên ảnh đẹp suốt buổi tiệc ạ.',
  },
  {
    q: 'Bó mini 3 bông cầm có gọn không shop? Mình định mua tặng cô giáo kèm hộp quà nhỏ.',
    a: 'Dạ bó mini cao khoảng 40–45 cm, rất nhẹ và gọn tay, đặt cạnh hộp quà hoặc túi quà cực kỳ cân đối và xinh xắn ạ. Các dịp lễ rất nhiều bạn học sinh chọn mẫu này tặng cô luôn đó ạ!',
  },
  {
    q: 'Đặt mẫu này có cần chuyển khoản đặt cọc trước không hay nhận hàng rồi thanh toán?',
    a: 'Dạ đơn hàng được ghi nhận ngay khi bạn đặt trên website. Sau đó Hoa Nelly sẽ liên hệ xác nhận lịch giao và hướng dẫn phương thức thanh toán phù hợp (chuyển khoản sau khi xác nhận hoặc thanh toán khi nhận hàng tùy khu vực) ạ.',
  },
  {
    q: 'Dây đèn LED đi kèm có sẵn pin chưa shop, bật sáng được lâu không ạ?',
    a: 'Dạ dây đèn LED đom đóm bên Hoa Nelly đều đã lắp sẵn pin và kiểm tra sáng trước khi giao, ánh vàng ấm rất dịu mắt và sáng liên tục nhiều giờ buổi tối ạ.',
  },
  {
    q: 'Shop ơi mẫu này cuối tuần này đặt từ thứ 6 thì sáng thứ 7 mấy giờ có thể giao tới khu vực Đống Đa ạ?',
    a: 'Dạ nếu bạn đặt từ thứ 6 thì sáng thứ 7 Hoa Nelly có thể giao sớm từ khung giờ 8:00–10:00 tại khu vực Đống Đa ạ. Tiệm sẽ chụp ảnh thành phẩm gửi bạn duyệt trước khi shipper xuất phát nhé!',
  },
  {
    q: 'Mình muốn đặt 10 bông phối 2 tông hồng phấn với xanh mint kèm thiệp viết tay riêng từng người thì tính phí thế nào shop?',
    a: 'Dạ phối 2 tông hồng phấn – xanh mint hoàn toàn miễn phí ạ! Thiệp viết tay giấy mỹ thuật Hoa Nelly tính ưu đãi cho đơn từ 10 bông trở lên, bạn ghi nội dung từng lời chúc khi đặt đơn hoặc nhắn Zalo tiệm để tiệm báo tổng giá tốt nhất nhé.',
  },
  {
    q: 'Bó này có thể gắn thêm chữ in tên "Chúc Mừng Minh Thư" lên phần nơ bóng hoặc bóng tim được không ạ?',
    a: 'Dạ được ạ! Hoa Nelly nhận cắt decal chữ tên riêng dán lên bóng pha lê, bóng trái tim hoặc tag giấy treo nơ rất tinh tế. Bạn chỉ cần điền dòng chữ mong muốn ở mục cá nhân hóa, tiệm sẽ căn bố cục hài hòa trước khi hoàn thiện ạ.',
  },
  {
    q: 'Tiệm có xuất biên nhận hoặc phiếu xác nhận thanh toán cho công ty đặt quà sinh nhật nhân viên không ạ?',
    a: 'Dạ có ạ! Hoa Nelly hỗ trợ xuất phiếu xác nhận đơn hàng, bảng kê chi tiết và chứng từ thanh toán đầy đủ theo thông tin phòng hành chính công ty cung cấp. Bạn để lại email công ty khi đặt đơn để tiệm gửi bản mềm ngay khi hoàn tất nhé.',
  },
  {
    q: 'Cho mình hỏi mẫu tạo hình bé gái chibi có đổi sang tạo hình bé trai mặc vest sinh nhật 3 tuổi được không shop?',
    a: 'Dạ hoàn toàn được ạ! Thợ tạo hình bên Hoa Nelly có thể làm bé trai chibi mặc vest tông xanh navy/xanh pastel kèm nơ cổ và số tuổi 3 cực dễ thương. Bạn đặt mục "Đặt thiết kế riêng" hoặc gửi ảnh bé để tiệm làm sát mẫu nhất nha.',
  },
  {
    q: 'Bó hoa khổng lồ này có vừa cốp sau xe ô tô 4 chỗ không ạ để mình tự qua shop chở về?',
    a: 'Dạ bó hoa khổng lồ cao khoảng 85–95 cm nên đặt ở hàng ghế sau xe 4 chỗ (ngả nhẹ lưng hoặc gập gọn) là thoải mái và an toàn nhất cho phom bóng ạ. Khi bạn ghé lấy, nhân viên tiệm sẽ bọc túi bảo vệ và hỗ trợ đặt gọn lên xe giúp bạn nhé!',
  },
  {
    q: 'Set phụ kiện bóng chữ sinh nhật có màu xanh dương pastel cho bé trai không ạ?',
    a: 'Dạ có sẵn đủ bảng màu gồm xanh dương pastel, bạc chrome, vàng đồng và hồng phấn ạ! Bạn chỉ cần ghi chú "Tông xanh dương pastel cho bé trai" khi đặt hàng là tiệm đóng gói đúng bộ kèm dây đèn mini và keo dán bóng đầy đủ ạ.',
  },
  {
    q: 'Gói trang trí góc chụp ảnh sinh nhật cho phòng khách chung cư ~15m² thì thi công mất bao lâu shop?',
    a: 'Dạ với không gian phòng khách ~15m², đội ngũ Hoa Nelly thường thi công hoàn chỉnh trong khoảng 60–90 phút ạ. Tiệm luôn sắp xếp đến trước giờ khai tiệc 2 tiếng để bạn kiểm tra góc chụp và điều chỉnh ánh sáng thoải mái nhất.',
  },
  {
    q: 'Mình muốn đổi sang tông tím oải hương toàn bộ bó hoa thì có cần đặt trước 24 tiếng không ạ?',
    a: 'Dạ màu tím oải hương là màu được yêu thích nên Hoa Nelly luôn có sẵn bóng tại xưởng. Bạn chỉ cần đặt trước 8–12 tiếng (hoặc 24 tiếng với mẫu bó cỡ lớn/tạo hình nhân vật) để tiệm phối sắc độ tím nhạt – trắng kem mềm mại nhất ạ.',
  },
  {
    q: 'Shop có nhận giao khung giờ sớm 7h30 sáng ở khu vực Hoàn Kiếm không ạ?',
    a: 'Dạ Hoa Nelly mở cửa từ 7:00 sáng nên có hỗ trợ giao sớm 7h30 tại Hoàn Kiếm cho các đơn đặt trước từ tối hôm trước ạ! Bạn chọn khung 08:00–10:00 và ghi chú "Giao sớm 7h30" để tiệm ưu tiên sắp xếp shipper đúng giờ nha.',
  },
  {
    q: 'Hoa bóng bay mang lên máy bay hoặc đi xe khách đường dài có giữ được phom không shop?',
    a: 'Dạ đi ô tô/xe khách dưới 2–3 tiếng trong khoang điều hòa thì hoa giữ phom rất tốt khi bọc túi bảo vệ của tiệm; còn khi đi máy bay do thay đổi áp suất khoang hành lý thì không khuyến nghị mang bóng đã bơm sẵn ạ. Tiệm có thể tư vấn gói mang xe ô tô tiện nhất cho bạn nhé!',
  },
  {
    q: 'Đế mica đứng trưng bày có tháo rời tái sử dụng cho các lần sau được không shop?',
    a: 'Dạ được ạ! Đế mica tròn trong suốt và thanh trụ đi kèm rất chắc chắn, bạn có thể lau sạch và giữ lại tái sử dụng cho các cụm hoa trang trí bàn tiệc hoặc góc làm việc lần sau cực kỳ tiện lợi ạ.',
  },
];

const CUSTOM_REQ_TEMPLATES = [
  {
    product_type: 'Bó hoa tạo hình nhân vật chibi theo ảnh',
    occasion: 'Tốt nghiệp',
    colors: 'Xanh pastel, trắng kem, vàng đồng',
    theme_character: 'Nữ cử nhân đeo kính tròn, tóc ngang vai cầm bằng tốt nghiệp',
    desired_size: 'Cỡ lớn (~60 cm)',
    personalization_text: 'Chúc mừng Tân Cử Nhân Ngọc Ánh',
    budget: '500.000₫ – 650.000₫',
    quoted_price: 580000,
    note: 'Nhờ shop làm nơ màu xanh pastel dịu và gửi ảnh duyệt trước khi giao sáng lễ tốt nghiệp.',
  },
  {
    product_type: 'Bó hoa bóng bay phối màu riêng',
    occasion: 'Sinh nhật',
    colors: 'Hồng phấn, tím oải hương, trắng ngọc trai',
    theme_character: 'Phong cách công chúa cánh bướm đính ngọc trai',
    desired_size: 'Cỡ lớn kèm đèn LED',
    personalization_text: 'Happy Birthday Thảo Vy 22+',
    budget: '550.000₫ – 700.000₫',
    quoted_price: 620000,
    note: 'Giao buổi tối 19h tại nhà hàng, nhờ giấu giá và kèm thiệp viết tay.',
  },
  {
    product_type: 'Hộp túi quà hoa bóng bay in tên thương hiệu',
    occasion: 'Khai trương',
    colors: 'Vàng đồng, cam đào, trắng sữa',
    theme_character: 'Tiệm bánh ngọt & trà chiều tone ấm',
    desired_size: 'Set 2 túi quà lớn trưng quầy',
    personalization_text: 'Khai Trương Hồng Phát – Tiệm Bánh Mây',
    budget: '800.000₫ – 1.000.000₫',
    quoted_price: 920000,
    note: 'Cần giao trước 8h30 sáng ngày khai trương để kịp đón khách.',
  },
  {
    product_type: 'Bó gấu bóng bay kỷ niệm cặp đôi',
    occasion: 'Kỷ niệm',
    colors: 'Đỏ ruby, hồng phấn, kem bơ',
    theme_character: 'Cặp gấu đôi ôm tim trắng kèm hoa hồng xoắn',
    desired_size: 'Cỡ tiêu chuẩn kèm đế mica đứng',
    personalization_text: 'Happy 2nd Anniversary · M & H',
    budget: '500.000₫ – 600.000₫',
    quoted_price: 540000,
    note: 'Đặt làm bất ngờ kỷ niệm 2 năm yêu nhau, cần bọc túi kín khi ship.',
  },
  {
    product_type: 'Set hoa bóng bay tri ân thầy cô & dịp lễ',
    occasion: 'Quà tặng người thương',
    colors: 'Hồng đào, trắng kem, xanh mint',
    theme_character: 'Tulip & cúc họa mi phong cách Hàn thanh lịch',
    desired_size: '1 bó lớn tặng cô chủ nhiệm + 6 bông lẻ tặng thầy cô bộ môn',
    personalization_text: 'Tri ân Cô Hương · Tập thể lớp 12A3',
    budget: '500.000₫ – 650.000₫',
    quoted_price: 560000,
    note: 'Giao tới cổng trường lúc 7h15 sáng, liên hệ lớp trưởng nhận ạ.',
  },
  {
    product_type: 'Cụm hoa bóng bay khổng lồ chụp ảnh studio',
    occasion: 'Sự kiện & Tiệc',
    colors: 'Trắng pha lê, bạc chrome, hồng baby',
    theme_character: 'Cụm hoa cúc cỡ đại và nơ foil ánh bạc',
    desired_size: 'Cao 1m1 có đế đứng chắc chắn',
    personalization_text: 'Welcome Baby Bắp',
    budget: '750.000₫ – 950.000₫',
    quoted_price: 850000,
    note: 'Chụp ảnh thôi nôi tại studio, cần giao bằng ô tô để giữ phom.',
  },
];

const EVENT_QUOTE_TEMPLATES = [
  {
    event_type: 'Tiệc sinh nhật bé gái tại nhà',
    venue_setting: 'indoor',
    scale_area: 'Phòng khách 20m², khoảng 15–20 khách',
    style_colors: 'Hồng phấn pastel, trắng kem, vàng đồng nhẹ, chủ đề công chúa bướm',
    desired_items: ['Backdrop tên & tuổi', 'Viền bóng bay nghệ thuật', 'Cụm hoa bóng đứng bàn bánh', 'Số tuổi ánh kim'],
    budget: '2.000.000₫ – 3.000.000₫',
    quoted_price: 2600000,
    note: 'Gia đình muốn dựng từ 15h chiều để 17h đón ông bà và bạn bè của bé.',
  },
  {
    event_type: 'Trang trí khai trương cửa hàng thời trang',
    venue_setting: 'outdoor',
    scale_area: 'Mặt tiền rộng 4.5m, sảnh đón khách',
    style_colors: 'Hồng dâu, trắng sữa, điểm nhấn chrome bạc theo logo shop',
    desired_items: ['Cổng bóng bay nghệ thuật', 'Cặp trụ hoa bóng đón khách', 'Bóng pha lê in tên thương hiệu'],
    budget: '3.500.000₫ – 5.000.000₫',
    quoted_price: 4200000,
    note: 'Mặt tiền có mái che, nhờ shop tư vấn loại bóng bền nắng nhẹ suốt ngày khai trương.',
  },
  {
    event_type: 'Tiệc thôi nôi bé trai tại nhà hàng',
    venue_setting: 'indoor',
    scale_area: 'Sảnh tiệc riêng 35m², ~35 khách',
    style_colors: 'Xanh pastel, kem bơ, trắng mây, chủ đề Gấu Nhỏ',
    desired_items: ['Backdrop vòm đôi', 'Cụm bóng hữu cơ phối gấu tạo hình', 'Trang trí bàn gallery', 'Cụm hoa bóng bàn tiệc'],
    budget: '4.500.000₫ – 6.000.000₫',
    quoted_price: 5200000,
    note: 'Nhà hàng cho setup trước 2 tiếng, shop gửi giúp phương án phối màu trước nhé.',
  },
  {
    event_type: 'Trang trí góc chụp ảnh sự kiện tại văn phòng',
    venue_setting: 'indoor',
    scale_area: 'Khu vực lễ tân rộng 3.5m × 2.5m',
    style_colors: 'Đào kem, hồng phấn, vàng champagne thanh lịch',
    desired_items: ['Backdrop chúc mừng', 'Viền hoa bóng bay nghệ thuật', '2 bó hoa cỡ lớn cầm chụp ảnh'],
    budget: '2.500.000₫ – 3.500.000₫',
    quoted_price: 3100000,
    note: 'Setup buổi tối hôm trước để sáng sớm nhân viên đến check-in luôn ạ.',
  },
  {
    event_type: 'Tiệc cầu hôn / kỷ niệm lãng mạn',
    venue_setting: 'indoor',
    scale_area: 'Phòng riêng khách sạn / homestay 25m²',
    style_colors: 'Trắng ngọc trai, hồng phấn, đỏ ruby và đèn LED ấm',
    desired_items: ['Cụm hoa hồng bóng bay trái tim', 'Bóng bay trần kèm ruy băng', 'Bó hoa cầm tay tặng người yêu', 'Dây đèn LED'],
    budget: '1.800.000₫ – 2.500.000₫',
    quoted_price: 2150000,
    note: 'Cần giữ bí mật tuyệt đối, mình sẽ nhắn mã phòng cho team vào setup lúc 16h.',
  },
];

const CONTACT_TEMPLATES = [
  {
    subject: 'Hỏi đặt hoa lẻ số lượng cho nhóm công ty dịp lễ',
    message: 'Chào Hoa Nelly, công ty mình định đặt khoảng 25 bông tulip bóng bay đơn kèm thiệp viết tay tặng chị em phòng nhân sự. Shop báo giúp thời gian chuẩn bị và mức chiết khấu nhé!',
  },
  {
    subject: 'Tư vấn giao nhanh trong ngày khu vực nội thành',
    message: 'Shop ơi mình cần đặt 1 bó hoa gấu pastel giao trong chiều nay trước 17h tại quận Đống Đa có kịp không ạ? Nhờ shop gọi lại tư vấn giúp mình mẫu sẵn nhanh nhất nhé.',
  },
  {
    subject: 'Đổi khung giờ nhận đơn hàng đã đặt',
    message: 'Chào tiệm, mình vừa đặt bó hoa sinh nhật nhưng bên tiệc đổi giờ từ 18h sang 19h30. Nhờ Hoa Nelly điều chỉnh lịch giao lùi lại giúp mình để hoa đến đúng lúc khai tiệc ạ.',
  },
  {
    subject: 'Hỏi cách bảo quản hoa bóng bay khi mang đi xa',
    message: 'Mình muốn mua bó hoa bóng bay mang về quê cách Hà Nội khoảng 40km đi ô tô thì có bị ảnh hưởng form hoa không shop? Tiệm có túi bọc lớn chống va quẹt không ạ?',
  },
  {
    subject: 'Tư vấn phối màu quà tặng cho lớp học / tập thể',
    message: 'Chào shop, lớp mình muốn đặt 1 bó hoa hồng xoắn trắng phong cách Hàn tặng cô chủ nhiệm và vài bông cúc họa mi lẻ cho thầy cô bộ môn. Nhờ shop gợi ý phối màu trang nhã nhé!',
  },
  {
    subject: 'Yêu cầu gửi biên nhận thanh toán cho công ty',
    message: 'Em vừa nhận xong đơn hàng hoa trang trí bàn tiệc rất đẹp ạ. Nhờ Hoa Nelly gửi giúp em phiếu xác nhận đơn hàng qua email để em làm thanh toán nội bộ phòng hành chính nhé.',
  },
  {
    subject: 'Hỏi đặt phụ kiện sinh nhật kèm bó mini 3 bông',
    message: 'Shop ơi mình muốn mua 1 set bóng chữ Happy Birthday tông vàng đồng kèm 2 bó hoa mini 3 bông tặng sinh nhật bạn thân, ghé trực tiếp cửa hàng lấy lúc 19h có sẵn không ạ?',
  },
];

function safeParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

interface MonthSpec {
  year: number;
  month: number;
  maxDay: number;
  targetPaidRevenue: number;
  bouquetCount: number;
  affordableCompletedCount: number;
  activePaidCount: number;
  activeUnpaidCount: number;
  cancelledCount: number;
  mildPeakDays: number[];
  reviewsTarget: number;
  qaCount: number;
  customReqCount: number;
  eventQuoteCount: number;
  contactCount: number;
}

interface OrderPlanEntry {
  year: number;
  month: number;
  day: number;
  maxDayInMonth: number;
  product: ParsedProduct;
  variant: ProductVariant | null;
  addon: ProductAddon | null;
  quantity: number;
  shippingFee: number;
  deliveryMethod: 'delivery' | 'pickup';
  status: 'completed' | 'delivering' | 'in_production' | 'confirmed' | 'pending_confirmation' | 'cancelled';
  paymentStatus: 'paid' | 'deposit_paid' | 'unpaid';
  cancelNote?: string;
}

function calcEntryPrice(entry: {
  product: ParsedProduct;
  variant: ProductVariant | null;
  addon: ProductAddon | null;
  quantity: number;
  shippingFee: number;
}): { unitPrice: number; surchargeTotal: number; lineTotal: number; subtotal: number; totalAmount: number } {
  const unitPrice = entry.product.base_price;
  const perUnitSurcharge = (entry.variant?.price_delta || 0) + (entry.addon?.price || 0);
  const surchargeTotal = perUnitSurcharge * entry.quantity;
  const subtotal = unitPrice * entry.quantity;
  const lineTotal = subtotal + surchargeTotal;
  const totalAmount = subtotal + surchargeTotal + entry.shippingFee;
  return { unitPrice, surchargeTotal, lineTotal, subtotal, totalAmount };
}

// Distribute `count` events almost evenly across EVERY day 1..maxDay so no day is empty and no single day spikes artificially
function generateEvenMonthlyDays(
  rng: () => number,
  count: number,
  maxDay: number,
  mildPeakDays: number[] = []
): number[] {
  if (count <= 0) return [];
  const counts = new Array<number>(maxDay).fill(0);
  const base = Math.floor(count / maxDay);
  let remainder = count - base * maxDay;

  for (let i = 0; i < maxDay; i++) {
    counts[i] = base;
  }

  const peakSet = new Set(mildPeakDays.filter((d) => d >= 1 && d <= maxDay));
  const dayIndices = Array.from({ length: maxDay }, (_, idx) => idx);
  shuffleInPlace(rng, dayIndices);
  dayIndices.sort((a, b) => {
    const ap = peakSet.has(a + 1) ? 0 : 1;
    const bp = peakSet.has(b + 1) ? 0 : 1;
    return ap - bp;
  });

  let ptr = 0;
  while (remainder > 0) {
    counts[dayIndices[ptr % maxDay]] += 1;
    remainder -= 1;
    ptr += 1;
  }

  // Tiny natural ±1 variation while strictly keeping every day >= max(1, base - 1) when count >= maxDay
  const minFloor = count >= maxDay ? Math.max(1, base - 1) : 0;
  const maxCeil = base + (peakSet.size > 0 ? 3 : 2);
  const swaps = Math.min(Math.floor(maxDay / 3), 7);
  for (let s = 0; s < swaps; s++) {
    const from = Math.floor(rng() * maxDay);
    const to = Math.floor(rng() * maxDay);
    if (from !== to && counts[from] > minFloor && counts[to] < maxCeil) {
      counts[from] -= 1;
      counts[to] += 1;
    }
  }

  const days: number[] = [];
  for (let d = 1; d <= maxDay; d++) {
    for (let k = 0; k < counts[d - 1]; k++) {
      days.push(d);
    }
  }
  return days;
}

interface CatalogOption {
  product: ParsedProduct;
  variant: ProductVariant | null;
  addon: ProductAddon | null;
  quantity: number;
  shippingFee: number;
  deliveryMethod: 'delivery' | 'pickup';
  totalAmount: number;
}

function buildAffordableOptions(affordableProducts: ParsedProduct[]): CatalogOption[] {
  const opts: CatalogOption[] = [];
  for (const p of affordableProducts) {
    const baseVariant = p.variants.find((v) => v.price_delta === 0) || null;
    const paidVariant = p.variants.find((v) => v.price_delta > 0) || null;
    const addon = p.addons[0] || null;

    opts.push({
      product: p,
      variant: baseVariant,
      addon: null,
      quantity: 1,
      shippingFee: 0,
      deliveryMethod: 'pickup',
      totalAmount: p.base_price,
    });
    if (paidVariant) {
      opts.push({
        product: p,
        variant: paidVariant,
        addon: null,
        quantity: 1,
        shippingFee: 0,
        deliveryMethod: 'pickup',
        totalAmount: p.base_price + paidVariant.price_delta,
      });
    }
    if (addon) {
      opts.push({
        product: p,
        variant: baseVariant,
        addon,
        quantity: 1,
        shippingFee: 0,
        deliveryMethod: 'pickup',
        totalAmount: p.base_price + addon.price,
      });
    }
    const ship = p.base_price >= 35000 ? 15000 : 10000;
    opts.push({
      product: p,
      variant: baseVariant,
      addon: null,
      quantity: 1,
      shippingFee: ship,
      deliveryMethod: 'delivery',
      totalAmount: p.base_price + ship,
    });
    if (p.base_price <= 25000) {
      opts.push({
        product: p,
        variant: baseVariant,
        addon: null,
        quantity: 2,
        shippingFee: 0,
        deliveryMethod: 'pickup',
        totalAmount: p.base_price * 2,
      });
    }
  }
  return opts;
}

// Select `count` real catalog combinations whose exact item-level sum converges to `targetTotal`
function selectConvergingOrders(
  rng: () => number,
  options: CatalogOption[],
  count: number,
  targetTotal: number
): CatalogOption[] {
  const sorted = [...options].sort((a, b) => a.totalAmount - b.totalAmount);
  const minPrice = sorted[0].totalAmount;
  const maxPrice = sorted[sorted.length - 1].totalAmount;
  const chosen: CatalogOption[] = [];
  let remainingBudget = targetTotal;

  for (let i = 0; i < count; i++) {
    const slotsLeft = count - i;
    const avgNeeded = remainingBudget / slotsLeft;

    const maxAllowed = remainingBudget - (slotsLeft - 1) * minPrice;
    const minAllowed = remainingBudget - (slotsLeft - 1) * maxPrice;

    const feasible = sorted.filter((o) => o.totalAmount >= minAllowed && o.totalAmount <= maxAllowed);
    const pool = feasible.length > 0 ? feasible : sorted;

    if (slotsLeft <= 6) {
      let best = pool[0];
      let bestDiff = Math.abs(best.totalAmount - avgNeeded);
      for (const o of pool) {
        const diff = Math.abs(o.totalAmount - avgNeeded);
        if (diff < bestDiff) {
          best = o;
          bestDiff = diff;
        }
      }
      chosen.push(best);
      remainingBudget -= best.totalAmount;
    } else {
      const spread = rng() < 0.14 ? 34000 : rng() < 0.35 ? 15000 : 7000;
      const desired = avgNeeded + (rng() * 2 - 1) * spread;
      const nearby = pool.filter((o) => Math.abs(o.totalAmount - desired) <= 12000);
      const pickPool = nearby.length > 0 ? nearby : pool;
      const selected = pick(rng, pickPool);
      chosen.push(selected);
      remainingBudget -= selected.totalAmount;
    }
  }

  return chosen;
}

// 12-month realistic business timeline (Dec 2025 – Nov 2026):
// - 3 zero-revenue months (2025-12, 2026-01, 2026-04): 0 orders, 0₫
// - 7 active months fluctuating cleanly in 2tr–4tr (2026-02, 03, 05, 06, 07, 08, 09)
// - Oct 2026: 6,000,000₫ (186 orders evenly across 31/31 days)
// - Nov 2026 (up to 23/11): ~9,000,000₫ (276 orders evenly across 23/23 days)
const ACTIVE_MONTH_SPECS: MonthSpec[] = [
  {
    year: 2026,
    month: 2,
    maxDay: 28,
    targetPaidRevenue: 2450000,
    bouquetCount: 2,
    affordableCompletedCount: 72,
    activePaidCount: 0,
    activeUnpaidCount: 0,
    cancelledCount: 2,
    mildPeakDays: [13, 14],
    reviewsTarget: 16,
    qaCount: 8,
    customReqCount: 4,
    eventQuoteCount: 3,
    contactCount: 4,
  },
  {
    year: 2026,
    month: 3,
    maxDay: 31,
    targetPaidRevenue: 3850000,
    bouquetCount: 4,
    affordableCompletedCount: 111,
    activePaidCount: 0,
    activeUnpaidCount: 0,
    cancelledCount: 3,
    mildPeakDays: [7, 8],
    reviewsTarget: 26,
    qaCount: 10,
    customReqCount: 7,
    eventQuoteCount: 5,
    contactCount: 6,
  },
  // 2026-04 intentionally 0 orders & 0₫ (off-season workshop upgrade)
  {
    year: 2026,
    month: 5,
    maxDay: 31,
    targetPaidRevenue: 2680000,
    bouquetCount: 2,
    affordableCompletedCount: 80,
    activePaidCount: 0,
    activeUnpaidCount: 0,
    cancelledCount: 2,
    mildPeakDays: [9, 10],
    reviewsTarget: 18,
    qaCount: 8,
    customReqCount: 5,
    eventQuoteCount: 3,
    contactCount: 5,
  },
  {
    year: 2026,
    month: 6,
    maxDay: 30,
    targetPaidRevenue: 3240000,
    bouquetCount: 3,
    affordableCompletedCount: 97,
    activePaidCount: 0,
    activeUnpaidCount: 0,
    cancelledCount: 2,
    mildPeakDays: [19, 20, 21],
    reviewsTarget: 22,
    qaCount: 10,
    customReqCount: 6,
    eventQuoteCount: 4,
    contactCount: 5,
  },
  {
    year: 2026,
    month: 7,
    maxDay: 31,
    targetPaidRevenue: 2180000,
    bouquetCount: 2,
    affordableCompletedCount: 64,
    activePaidCount: 0,
    activeUnpaidCount: 0,
    cancelledCount: 2,
    mildPeakDays: [15, 25],
    reviewsTarget: 15,
    qaCount: 8,
    customReqCount: 4,
    eventQuoteCount: 3,
    contactCount: 4,
  },
  {
    year: 2026,
    month: 8,
    maxDay: 31,
    targetPaidRevenue: 2920000,
    bouquetCount: 3,
    affordableCompletedCount: 87,
    activePaidCount: 0,
    activeUnpaidCount: 0,
    cancelledCount: 2,
    mildPeakDays: [14, 22],
    reviewsTarget: 20,
    qaCount: 9,
    customReqCount: 6,
    eventQuoteCount: 4,
    contactCount: 5,
  },
  {
    year: 2026,
    month: 9,
    maxDay: 30,
    targetPaidRevenue: 3640000,
    bouquetCount: 4,
    affordableCompletedCount: 105,
    activePaidCount: 0,
    activeUnpaidCount: 0,
    cancelledCount: 3,
    mildPeakDays: [5, 25],
    reviewsTarget: 25,
    qaCount: 10,
    customReqCount: 7,
    eventQuoteCount: 5,
    contactCount: 6,
  },
  {
    year: 2026,
    month: 10,
    maxDay: 31,
    targetPaidRevenue: 6000000,
    bouquetCount: 6,
    affordableCompletedCount: 176,
    activePaidCount: 0,
    activeUnpaidCount: 0,
    cancelledCount: 4,
    mildPeakDays: [18, 19, 20],
    reviewsTarget: 46,
    qaCount: 13,
    customReqCount: 12,
    eventQuoteCount: 7,
    contactCount: 10,
  },
  {
    year: 2026,
    month: 11,
    maxDay: 23,
    targetPaidRevenue: 8960000,
    bouquetCount: 8,
    affordableCompletedCount: 255,
    activePaidCount: 4,
    activeUnpaidCount: 4,
    cancelledCount: 5,
    mildPeakDays: [18, 19, 20],
    reviewsTarget: 66,
    qaCount: 14,
    customReqCount: 15,
    eventQuoteCount: 9,
    contactCount: 13,
  },
];

export function seedDemoActivity(db: Database.Database): void {
  // Idempotency guard for V2 realistic multi-month sales dataset
  const existingV2Count = (
    db
      .prepare(`SELECT COUNT(*) as c FROM orders WHERE idempotency_key LIKE 'DEMO-V2-HN-%'`)
      .get() as { c: number }
  ).c;
  if (existingV2Count >= 1000) {
    return;
  }

  const productRows = db
    .prepare(
      'SELECT id, sku, slug, name, category_slug, pricing_type, base_price, images_json, variants_json, addons_json FROM products WHERE is_active = 1 ORDER BY id ASC'
    )
    .all() as DbProductRow[];

  const allProducts: ParsedProduct[] = productRows
    .filter((r) => r.pricing_type !== 'quote' && r.base_price !== null)
    .map((r) => ({
      id: r.id,
      sku: r.sku,
      slug: r.slug,
      name: r.name,
      category_slug: r.category_slug,
      pricing_type: r.pricing_type,
      base_price: Number(r.base_price),
      images: safeParse<string[]>(r.images_json, []),
      variants: safeParse<ProductVariant[]>(r.variants_json, []),
      addons: safeParse<ProductAddon[]>(r.addons_json, []),
    }));

  const bySku = new Map<string, ParsedProduct>(allProducts.map((p) => [p.sku, p]));

  const affordableSkus = ['HN-PK-004', 'HN-HBB-013', 'HN-HBB-014', 'HN-HBB-015', 'HN-PK-003', 'HN-QT-004'];
  const affordableProducts = affordableSkus
    .map((sku) => bySku.get(sku))
    .filter((p): p is ParsedProduct => Boolean(p));

  const bouquetProducts = allProducts.filter((p) => !affordableSkus.includes(p.sku));

  if (affordableProducts.length === 0 || bouquetProducts.length === 0) {
    return;
  }

  const rng = createRng(20261123);
  const affordableOptions = buildAffordableOptions(affordableProducts);
  const lowValueUnpaidOptions = affordableOptions.filter((o) => o.totalAmount >= 12000 && o.totalAmount <= 25000);
  const sortedBouquets = [...bouquetProducts].sort((a, b) => a.base_price - b.base_price);

  // Build full multi-month order plans cycling through all 21 signature bouquets across the year
  const allOrderPlans: OrderPlanEntry[] = [];
  let bouquetCursor = 0;

  for (const spec of ACTIVE_MONTH_SPECS) {
    const totalOrdersInMonth =
      spec.bouquetCount +
      spec.affordableCompletedCount +
      spec.activePaidCount +
      spec.activeUnpaidCount +
      spec.cancelledCount;

    const allDays = generateEvenMonthlyDays(rng, totalOrdersInMonth, spec.maxDay, spec.mildPeakDays);

    // Reserve the last `activePaidCount + activeUnpaidCount` slots (all on the final 1–2 days of Nov) for active orders
    const activeCount = spec.activePaidCount + spec.activeUnpaidCount;
    const historyDays = allDays.slice(0, allDays.length - activeCount);
    const activeDays = allDays.slice(allDays.length - activeCount);

    let bouquetSum = 0;
    const bouquetPlans: Omit<OrderPlanEntry, 'day'>[] = [];
    for (let b = 0; b < spec.bouquetCount; b++) {
      const p = sortedBouquets[bouquetCursor % sortedBouquets.length];
      bouquetCursor += 1;
      const variant = p.variants.find((v) => v.price_delta === 0) || null;
      const addon = rng() < 0.35 && p.addons.length > 0 ? p.addons[0] : null;
      const deliveryMethod: 'delivery' | 'pickup' = rng() < 0.72 ? 'delivery' : 'pickup';
      const shippingFee = deliveryMethod === 'delivery' ? 20000 : 0;
      const calc = calcEntryPrice({ product: p, variant, addon, quantity: 1, shippingFee });
      bouquetSum += calc.totalAmount;
      bouquetPlans.push({
        year: spec.year,
        month: spec.month,
        maxDayInMonth: spec.maxDay,
        product: p,
        variant,
        addon,
        quantity: 1,
        shippingFee,
        deliveryMethod,
        status: 'completed',
        paymentStatus: 'paid',
      });
    }

    const paidAffordableCount = spec.affordableCompletedCount + spec.activePaidCount;
    const affordablePaidChosen = selectConvergingOrders(
      rng,
      affordableOptions,
      paidAffordableCount,
      spec.targetPaidRevenue - bouquetSum
    );

    const completedAffordable = affordablePaidChosen.slice(0, spec.affordableCompletedCount);
    const activePaidAffordable = affordablePaidChosen.slice(spec.affordableCompletedCount);

    const cancelledPlans: Omit<OrderPlanEntry, 'day'>[] = Array.from({ length: spec.cancelledCount }, () => {
      const opt = pick(rng, affordableOptions);
      return {
        year: spec.year,
        month: spec.month,
        maxDayInMonth: spec.maxDay,
        product: opt.product,
        variant: opt.variant,
        addon: opt.addon,
        quantity: opt.quantity,
        shippingFee: opt.shippingFee,
        deliveryMethod: opt.deliveryMethod,
        status: 'cancelled',
        paymentStatus: 'unpaid',
        cancelNote: pick(rng, CANCEL_REASONS),
      };
    });

    const historyRaw: Omit<OrderPlanEntry, 'day'>[] = [
      ...bouquetPlans,
      ...completedAffordable.map((o) => ({
        year: spec.year,
        month: spec.month,
        maxDayInMonth: spec.maxDay,
        product: o.product,
        variant: o.variant,
        addon: o.addon,
        quantity: o.quantity,
        shippingFee: o.shippingFee,
        deliveryMethod: o.deliveryMethod,
        status: 'completed' as const,
        paymentStatus: 'paid' as const,
      })),
      ...cancelledPlans,
    ];
    shuffleInPlace(rng, historyRaw);

    for (let i = 0; i < historyRaw.length; i++) {
      allOrderPlans.push({ ...historyRaw[i], day: historyDays[i] });
    }

    // Active orders on the final 1–2 days of Nov (keeping total daily order count uniform!)
    if (activeCount > 0) {
      const activeDefs: Array<{
        status: OrderPlanEntry['status'];
        paymentStatus: OrderPlanEntry['paymentStatus'];
      }> = [
        { status: 'delivering', paymentStatus: 'paid' },
        { status: 'delivering', paymentStatus: 'paid' },
        { status: 'in_production', paymentStatus: 'paid' },
        { status: 'in_production', paymentStatus: 'paid' },
        { status: 'confirmed', paymentStatus: 'deposit_paid' },
        { status: 'confirmed', paymentStatus: 'unpaid' },
        { status: 'pending_confirmation', paymentStatus: 'unpaid' },
        { status: 'pending_confirmation', paymentStatus: 'unpaid' },
      ];

      for (let i = 0; i < activeCount; i++) {
        const isPaidSlot = i < spec.activePaidCount;
        const opt = isPaidSlot
          ? activePaidAffordable[i]
          : pick(rng, lowValueUnpaidOptions.length > 0 ? lowValueUnpaidOptions : affordableOptions);
        const def = activeDefs[i % activeDefs.length];
        allOrderPlans.push({
          year: spec.year,
          month: spec.month,
          maxDayInMonth: spec.maxDay,
          day: activeDays[i],
          product: opt.product,
          variant: opt.variant,
          addon: opt.addon,
          quantity: opt.quantity,
          shippingFee: opt.shippingFee,
          deliveryMethod: opt.deliveryMethod,
          status: def.status,
          paymentStatus: def.paymentStatus,
        });
      }
    }
  }

  // Prepare SQL statements & migrate cleanly inside a single atomic transaction
  const insertOrderStmt = db.prepare(`
    INSERT INTO orders (
      idempotency_key, order_code, lookup_token, status, payment_status, payment_method,
      customer_name, customer_phone, customer_email, delivery_method, delivery_address,
      recipient_name, recipient_phone, desired_date, desired_time_slot, schedule_confirmed,
      hide_price_for_recipient, customer_note, subtotal, surcharge_total, shipping_fee,
      shipping_fee_status, discount_code, discount_amount, total_amount, deposit_required,
      deposit_paid_amount, has_custom_quote_items, admin_note, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertOrderItemStmt = db.prepare(`
    INSERT INTO order_items (
      order_id, product_id, product_slug, product_name, product_sku, product_image,
      quantity, unit_price, surcharge_total, line_total,
      selected_variants_json, selected_addons_json, personalization_json, review_token
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertReviewStmt = db.prepare(`
    INSERT INTO reviews (
      product_id, order_item_id, display_name, rating, comment, images_json,
      variant_summary, verified_purchase, status, moderation_reason, is_edited, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'published', NULL, 0, ?, ?)
  `);

  const insertReplyStmt = db.prepare(`
    INSERT INTO review_replies (
      review_id, staff_name, content, is_edited, created_at, updated_at
    ) VALUES (?, ?, ?, 0, ?, ?)
  `);

  const insertQuestionStmt = db.prepare(`
    INSERT INTO product_questions (
      product_id, asker_name, question, answer, answered_by, answered_at, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'published', ?)
  `);

  const insertCustomReqStmt = db.prepare(`
    INSERT INTO custom_requests (
      idempotency_key, reference_code, product_type, occasion, colors, theme_character,
      desired_size, personalization_text, budget, needed_date, reference_images_json,
      customer_name, customer_phone, customer_email, customer_note, status,
      quoted_price, admin_note, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertEventQuoteStmt = db.prepare(`
    INSERT INTO event_quotes (
      idempotency_key, reference_code, event_type, event_date, event_time, location,
      venue_setting, scale_area, style_colors, desired_items_json, budget,
      reference_images_json, customer_name, customer_phone, customer_email,
      customer_note, status, quoted_price, admin_note, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertContactStmt = db.prepare(`
    INSERT INTO contact_messages (
      reference_code, customer_name, customer_phone, customer_email,
      subject, message, status, admin_note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  interface CompletedOrderItemRef {
    orderItemId: number;
    product: ParsedProduct;
    displayName: string;
    variantSummary: string;
    orderCreatedUtc: string;
    month: number;
    isBouquet: boolean;
  }

  const completedByMonth = new Map<number, CompletedOrderItemRef[]>();

  const runTransaction = db.transaction(() => {
    // 0. Cleanly replace any prior V1 demo rows without touching real user orders, products, or admin accounts
    const v1OrdersCount = (
      db
        .prepare(`SELECT COUNT(*) as c FROM orders WHERE idempotency_key LIKE 'DEMO-HN-2026-%'`)
        .get() as { c: number }
    ).c;
    if (v1OrdersCount > 0) {
      // ON DELETE CASCADE cleans up associated order_items, reviews, and review_replies automatically
      db.prepare(`DELETE FROM orders WHERE idempotency_key LIKE 'DEMO-HN-2026-%'`).run();
      db.prepare(`DELETE FROM custom_requests WHERE idempotency_key LIKE 'DEMO-CR-2026-%'`).run();
      db.prepare(`DELETE FROM event_quotes WHERE idempotency_key LIKE 'DEMO-EV-2026-%'`).run();
      db.prepare(`DELETE FROM contact_messages WHERE reference_code LIKE 'LH-26%'`).run();
      db.prepare(`DELETE FROM product_questions`).run();
    }

    // ------------------------------------------------------------------------
    // 1. INSERT MULTI-MONTH ORDERS & ORDER ITEMS
    // ------------------------------------------------------------------------
    const monthSeqMap = new Map<number, number>();

    for (const plan of allOrderPlans) {
      const seq = (monthSeqMap.get(plan.month) || 0) + 1;
      monthSeqMap.set(plan.month, seq);

      const monthStr = pad2(plan.month);
      const dayStr = pad2(plan.day);
      const seqStr = String(seq).padStart(3, '0');
      const idempotencyKey = `DEMO-V2-HN-${plan.year}-${monthStr}-${seqStr}`;
      const orderCode = `HN-${String(plan.year).slice(-2)}${monthStr}${dayStr}-${seqStr}`;
      const lookupToken = crypto
        .createHash('sha256')
        .update(`lookup:${idempotencyKey}`)
        .digest('hex')
        .slice(0, 24);
      const reviewToken = crypto
        .createHash('sha256')
        .update(`review:${idempotencyKey}`)
        .digest('hex')
        .slice(0, 24);

      const hourVn = randInt(rng, 7, 21);
      const minuteVn = randInt(rng, 0, 59);
      const secondVn = randInt(rng, 0, 59);
      const createdUtc = vnToSqliteUtc(plan.year, plan.month, plan.day, hourVn, minuteVn, secondVn);
      const updatedUtc =
        plan.status === 'completed'
          ? addHoursClamped(createdUtc, randInt(rng, 4, 20))
          : addHoursClamped(createdUtc, randInt(rng, 1, 3));

      const cust = makeCustomer(rng);
      const deliveryAddress = plan.deliveryMethod === 'delivery' ? makeAddress(rng) : null;
      const isGift = rng() < 0.28;
      const recipient = isGift ? makeCustomer(rng) : null;

      const maxDesiredDay = plan.month === 11 ? 25 : plan.maxDayInMonth;
      const desiredDay = Math.min(maxDesiredDay, plan.day + (rng() < 0.55 ? 0 : 1));
      const desiredDate = `${plan.year}-${monthStr}-${pad2(desiredDay)}`;
      const desiredSlot = pick(rng, TIME_SLOTS);
      const monthCards = CARD_MESSAGES_BY_MONTH[plan.month] || CARD_MESSAGES_BY_MONTH[11];
      const cardMsg = rng() < 0.45 ? pick(rng, monthCards) : undefined;
      const custNote = pick(rng, ORDER_CUSTOMER_NOTES) || null;

      const calc = calcEntryPrice(plan);
      const paymentMethod =
        plan.deliveryMethod === 'pickup' && rng() < 0.45 ? 'cod_upon_confirm' : 'confirm_then_transfer';
      const scheduleConfirmed = plan.status !== 'pending_confirmation' && plan.status !== 'cancelled' ? 1 : 0;
      const depositPaid =
        plan.paymentStatus === 'deposit_paid' ? Math.round(calc.totalAmount * 0.5) : 0;
      const adminNote =
        plan.cancelNote ||
        (plan.status === 'completed'
          ? 'Đã giao đúng hẹn và xác nhận khách hài lòng.'
          : plan.status === 'delivering'
            ? 'Shipper đang trên đường giao tới khách.'
            : plan.status === 'in_production'
              ? 'Đang tạo hình và thắt nơ tại xưởng Hoa Nelly.'
              : null);

      const orderInfo = insertOrderStmt.run(
        idempotencyKey,
        orderCode,
        lookupToken,
        plan.status,
        plan.paymentStatus,
        paymentMethod,
        cust.name,
        cust.phone,
        cust.email || null,
        plan.deliveryMethod,
        deliveryAddress,
        recipient?.name || null,
        recipient?.phone || null,
        desiredDate,
        desiredSlot,
        scheduleConfirmed,
        isGift ? 1 : 0,
        custNote,
        calc.subtotal,
        calc.surchargeTotal,
        plan.shippingFee,
        'confirmed',
        null,
        0,
        calc.totalAmount,
        null,
        depositPaid,
        0,
        adminNote,
        createdUtc,
        updatedUtc
      );

      const orderId = Number(orderInfo.lastInsertRowid);
      const selectedVariantsObj: Record<string, { id: string; label: string; price_delta: number }> = {};
      if (plan.variant) {
        selectedVariantsObj[plan.variant.group] = {
          id: plan.variant.id,
          label: plan.variant.label,
          price_delta: plan.variant.price_delta,
        };
      }
      const selectedAddonsArr = plan.addon
        ? [{ id: plan.addon.id, label: plan.addon.label, price: plan.addon.price }]
        : [];
      const personalizationObj = cardMsg ? { card_message: cardMsg } : {};

      const itemInfo = insertOrderItemStmt.run(
        orderId,
        plan.product.id,
        plan.product.slug,
        plan.product.name,
        plan.product.sku,
        plan.product.images[0] || '',
        plan.quantity,
        calc.unitPrice,
        calc.surchargeTotal,
        calc.lineTotal,
        JSON.stringify(selectedVariantsObj),
        JSON.stringify(selectedAddonsArr),
        JSON.stringify(personalizationObj),
        reviewToken
      );

      if (plan.status === 'completed') {
        const variantSummaryParts: string[] = [];
        if (plan.variant) variantSummaryParts.push(plan.variant.label);
        if (plan.addon) variantSummaryParts.push(plan.addon.label);
        if (plan.quantity > 1) variantSummaryParts.push(`SL ${plan.quantity}`);

        const ref: CompletedOrderItemRef = {
          orderItemId: Number(itemInfo.lastInsertRowid),
          product: plan.product,
          displayName: cust.displayName,
          variantSummary: variantSummaryParts.join(' · '),
          orderCreatedUtc: createdUtc,
          month: plan.month,
          isBouquet: !affordableSkus.includes(plan.product.sku),
        };
        const list = completedByMonth.get(plan.month);
        if (list) list.push(ref);
        else completedByMonth.set(plan.month, [ref]);
      }
    }

    // ------------------------------------------------------------------------
    // 2. SEED 254 VERIFIED-PURCHASE REVIEWS ACROSS ALL 9 ACTIVE MONTHS + REPLIES
    // ------------------------------------------------------------------------
    const chosenReviewItems: CompletedOrderItemRef[] = [];
    for (const spec of ACTIVE_MONTH_SPECS) {
      const monthItems = completedByMonth.get(spec.month) || [];
      const bouquets = monthItems.filter((x) => x.isBouquet);
      const affordable = shuffleInPlace(rng, monthItems.filter((x) => !x.isBouquet));
      const neededAff = Math.max(0, spec.reviewsTarget - bouquets.length);
      chosenReviewItems.push(...bouquets, ...affordable.slice(0, neededAff));
    }

    chosenReviewItems.sort((a, b) => a.orderCreatedUtc.localeCompare(b.orderCreatedUtc));
    const totalReviews = chosenReviewItems.length;

    for (let i = 0; i < totalReviews; i++) {
      const ref = chosenReviewItems[i];
      const rRoll = rng();
      const rating = rRoll < 0.85 ? 5 : rRoll < 0.97 ? 4 : 3;

      let comment: string;
      if (rating === 5) {
        const opener = REVIEW_OPENERS_5[(i * 7 + randInt(rng, 0, 2)) % REVIEW_OPENERS_5.length];
        const detail = REVIEW_DETAILS_5[(i * 5 + randInt(rng, 0, 3)) % REVIEW_DETAILS_5.length];
        comment = rng() < 0.65 ? `${opener} ${detail}` : opener;
      } else if (rating === 4) {
        comment = REVIEW_COMMENTS_4[i % REVIEW_COMMENTS_4.length];
      } else {
        comment = REVIEW_COMMENTS_3[i % REVIEW_COMMENTS_3.length];
      }

      const reviewImages: string[] = [];
      if (rng() < 0.34 && ref.product.images.length > 0) {
        reviewImages.push(ref.product.images[0]);
        if (ref.product.images.length > 1 && rng() < 0.35) {
          reviewImages.push(ref.product.images[1]);
        }
      }

      const revCreatedUtc = addHoursClamped(ref.orderCreatedUtc, randInt(rng, 12, 48));
      const revInfo = insertReviewStmt.run(
        ref.product.id,
        ref.orderItemId,
        ref.displayName,
        rating,
        comment,
        JSON.stringify(reviewImages),
        ref.variantSummary,
        revCreatedUtc,
        revCreatedUtc
      );
      const reviewId = Number(revInfo.lastInsertRowid);

      // Reply to ~92% of reviews (including all latest 10 shown on homepage & product pages)
      const shouldReply = i >= totalReviews - 10 || i < totalReviews - 28 || i % 3 !== 1;
      if (shouldReply) {
        const replyPool = rating === 5 ? SHOP_REPLIES_5 : rating === 4 ? SHOP_REPLIES_4 : SHOP_REPLIES_3;
        const replyContent = replyPool[i % replyPool.length];
        const replyUtc = addHoursClamped(revCreatedUtc, randInt(rng, 2, 14));
        insertReplyStmt.run(
          reviewId,
          pick(rng, STAFF_REPLY_NAMES),
          replyContent,
          replyUtc,
          replyUtc
        );
      }
    }

    // ------------------------------------------------------------------------
    // 3. SEED 90 PRODUCT Q&As ACROSS ALL 9 ACTIVE MONTHS — 100% PRE-ANSWERED!
    // ------------------------------------------------------------------------
    const allProductIds = productRows.map((p) => p.id);
    let qaGlobalIdx = 0;

    for (const spec of ACTIVE_MONTH_SPECS) {
      const qaDays = generateEvenMonthlyDays(rng, spec.qaCount, spec.maxDay, spec.mildPeakDays);
      for (let i = 0; i < qaDays.length; i++) {
        const day = qaDays[i];
        const productId = allProductIds[qaGlobalIdx % allProductIds.length];
        const tpl = QA_TEMPLATES[qaGlobalIdx % QA_TEMPLATES.length];
        const asker = makeCustomer(rng);
        const createdUtc = vnToSqliteUtc(
          spec.year,
          spec.month,
          day,
          randInt(rng, 8, 20),
          randInt(rng, 0, 59),
          randInt(rng, 0, 59)
        );
        const answeredUtc = addHoursClamped(createdUtc, randInt(rng, 1, 5));

        insertQuestionStmt.run(
          productId,
          asker.displayName,
          tpl.q,
          tpl.a,
          pick(rng, STAFF_REPLY_NAMES),
          answeredUtc,
          createdUtc
        );
        qaGlobalIdx += 1;
      }
    }

    // ------------------------------------------------------------------------
    // 4. SEED 66 CUSTOM DESIGN REQUESTS SPREAD ACROSS ALL 9 ACTIVE MONTHS
    // ------------------------------------------------------------------------
    const customStatusesHistory = ['completed', 'completed', 'completed', 'confirmed', 'quoted'] as const;
    const customStatusesRecent = ['consulting', 'quoted', 'new', 'new'] as const;
    let customSeq = 0;

    for (const spec of ACTIVE_MONTH_SPECS) {
      const days = generateEvenMonthlyDays(rng, spec.customReqCount, spec.maxDay, spec.mildPeakDays);
      for (let i = 0; i < days.length; i++) {
        customSeq += 1;
        const day = days[i];
        const seqStr = String(customSeq).padStart(3, '0');
        const tpl = CUSTOM_REQ_TEMPLATES[(customSeq - 1) % CUSTOM_REQ_TEMPLATES.length];
        const cust = makeCustomer(rng);
        const isRecentNov = spec.month === 11 && i >= days.length - 4;
        const status = isRecentNov
          ? customStatusesRecent[i - (days.length - 4)]
          : customStatusesHistory[(customSeq - 1) % customStatusesHistory.length];
        const quotedPrice = status === 'new' || status === 'consulting' ? null : tpl.quoted_price;
        const maxNeeded = spec.month === 11 ? 28 : spec.maxDay;
        const neededDay = Math.min(maxNeeded, day + randInt(rng, 2, 5));
        const createdUtc = vnToSqliteUtc(
          spec.year,
          spec.month,
          day,
          randInt(rng, 8, 21),
          randInt(rng, 0, 59),
          randInt(rng, 0, 59)
        );
        const updatedUtc = addHoursClamped(createdUtc, randInt(rng, 2, 16));
        const refProd = bouquetProducts[(customSeq - 1) % bouquetProducts.length];
        const refImages = refProd.images[0] ? [refProd.images[0]] : [];

        insertCustomReqStmt.run(
          `DEMO-V2-CR-${spec.year}-${seqStr}`,
          `TK-${String(spec.year).slice(-2)}${pad2(spec.month)}${pad2(day)}-${seqStr}`,
          tpl.product_type,
          tpl.occasion,
          tpl.colors,
          tpl.theme_character,
          tpl.desired_size,
          tpl.personalization_text,
          tpl.budget,
          `${spec.year}-${pad2(spec.month)}-${pad2(neededDay)}`,
          JSON.stringify(refImages),
          cust.name,
          cust.phone,
          cust.email,
          tpl.note,
          status,
          quotedPrice,
          status === 'completed'
            ? 'Đã hoàn thiện mẫu và giao khách đúng lịch.'
            : status === 'confirmed'
              ? 'Khách đã chốt phương án màu và đặt cọc.'
              : status === 'quoted'
                ? 'Đã gửi bảng phối màu và báo giá chi tiết qua Zalo.'
                : null,
          createdUtc,
          updatedUtc
        );
      }
    }

    // ------------------------------------------------------------------------
    // 5. SEED 43 EVENT DECORATION QUOTES SPREAD ACROSS ALL 9 ACTIVE MONTHS
    // ------------------------------------------------------------------------
    const eventStatusesHistory = ['completed', 'completed', 'confirmed', 'quoted'] as const;
    const eventStatusesRecent = ['consulting', 'quoted', 'new'] as const;
    let eventSeq = 0;

    for (const spec of ACTIVE_MONTH_SPECS) {
      const days = generateEvenMonthlyDays(rng, spec.eventQuoteCount, spec.maxDay, spec.mildPeakDays);
      for (let i = 0; i < days.length; i++) {
        eventSeq += 1;
        const day = days[i];
        const seqStr = String(eventSeq).padStart(3, '0');
        const tpl = EVENT_QUOTE_TEMPLATES[(eventSeq - 1) % EVENT_QUOTE_TEMPLATES.length];
        const cust = makeCustomer(rng);
        const isRecentNov = spec.month === 11 && i >= days.length - 3;
        const status = isRecentNov
          ? eventStatusesRecent[i - (days.length - 3)]
          : eventStatusesHistory[(eventSeq - 1) % eventStatusesHistory.length];
        const quotedPrice = status === 'new' || status === 'consulting' ? null : tpl.quoted_price;
        const maxEvDay = spec.month === 11 ? 30 : spec.maxDay;
        const evDay = Math.min(maxEvDay, day + randInt(rng, 3, 8));
        const createdUtc = vnToSqliteUtc(
          spec.year,
          spec.month,
          day,
          randInt(rng, 8, 20),
          randInt(rng, 0, 59),
          randInt(rng, 0, 59)
        );
        const updatedUtc = addHoursClamped(createdUtc, randInt(rng, 3, 20));
        const refProd = bouquetProducts[(eventSeq * 2) % bouquetProducts.length];
        const refImages = refProd.images[0] ? [refProd.images[0]] : [];

        insertEventQuoteStmt.run(
          `DEMO-V2-EV-${spec.year}-${seqStr}`,
          `SK-${String(spec.year).slice(-2)}${pad2(spec.month)}${pad2(day)}-${seqStr}`,
          tpl.event_type,
          `${spec.year}-${pad2(spec.month)}-${pad2(evDay)}`,
          `${pad2(randInt(rng, 9, 18))}:00`,
          makeAddress(rng),
          tpl.venue_setting,
          tpl.scale_area,
          tpl.style_colors,
          JSON.stringify(tpl.desired_items),
          tpl.budget,
          JSON.stringify(refImages),
          cust.name,
          cust.phone,
          cust.email,
          tpl.note,
          status,
          quotedPrice,
          status === 'completed'
            ? 'Đã thi công xong và khách rất hài lòng với góc chụp ảnh.'
            : status === 'confirmed'
              ? 'Đã khảo sát mặt bằng và chốt lịch thi công.'
              : status === 'quoted'
                ? 'Đã gửi phương án phối màu và báo giá chi tiết các hạng mục.'
                : null,
          createdUtc,
          updatedUtc
        );
      }
    }

    // ------------------------------------------------------------------------
    // 6. SEED 58 CONTACT / SUPPORT MESSAGES SPREAD ACROSS ALL 9 ACTIVE MONTHS
    // ------------------------------------------------------------------------
    let contactSeq = 0;

    for (const spec of ACTIVE_MONTH_SPECS) {
      const days = generateEvenMonthlyDays(rng, spec.contactCount, spec.maxDay, spec.mildPeakDays);
      for (let i = 0; i < days.length; i++) {
        contactSeq += 1;
        const day = days[i];
        const seqStr = String(contactSeq).padStart(3, '0');
        const tpl = CONTACT_TEMPLATES[(contactSeq - 1) % CONTACT_TEMPLATES.length];
        const cust = makeCustomer(rng);
        const isNewNov = spec.month === 11 && i >= days.length - 4;
        const status: 'new' | 'replied' | 'closed' = isNewNov
          ? 'new'
          : contactSeq % 3 === 0
            ? 'closed'
            : 'replied';
        const createdUtc = vnToSqliteUtc(
          spec.year,
          spec.month,
          day,
          randInt(rng, 8, 21),
          randInt(rng, 0, 59),
          randInt(rng, 0, 59)
        );

        insertContactStmt.run(
          `LH-${String(spec.year).slice(-2)}${pad2(spec.month)}${pad2(day)}-${seqStr}`,
          cust.name,
          cust.phone,
          cust.email,
          tpl.subject,
          tpl.message,
          status,
          status === 'new' ? null : 'Đã gọi điện và gửi thông tin tư vấn chi tiết cho khách.',
          createdUtc
        );
      }
    }
  });

  runTransaction();
}
