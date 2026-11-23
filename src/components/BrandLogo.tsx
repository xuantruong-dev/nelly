const BRAND_LOGO_WEBP_420 = '/assets/aistudio/hoa_nelly_logo_420.webp';
const BRAND_LOGO_WEBP = '/assets/aistudio/hoa_nelly_logo.webp';
const BRAND_LOGO_PNG = '/assets/aistudio/hoa_nelly_logo.png';
const BRAND_LOGO_WIDTH = 980;
const BRAND_LOGO_HEIGHT = 221;

export function BrandLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' | 'nav' }) {
  const heightClass =
    size === 'sm'
      ? 'h-[30px]'
      : size === 'lg'
        ? 'h-[44px] sm:h-[50px]'
        : size === 'nav'
          ? 'h-[28px] min-[400px]:h-[31px] sm:h-[34px] min-[1200px]:h-[36px] min-[1360px]:h-[38px]'
          : 'h-[36px] sm:h-[40px]';

  return (
    <picture className="inline-flex items-center shrink-0 select-none leading-none bg-transparent">
      <source
        srcSet={`${BRAND_LOGO_WEBP_420} 420w, ${BRAND_LOGO_WEBP} 980w`}
        sizes="(max-width: 640px) 160px, 210px"
        type="image/webp"
      />
      <img
        src={BRAND_LOGO_PNG}
        alt="Hoa Nelly"
        width={BRAND_LOGO_WIDTH}
        height={BRAND_LOGO_HEIGHT}
        decoding="async"
        fetchPriority={size === 'nav' ? 'high' : 'auto'}
        draggable={false}
        className={`${heightClass} w-auto max-w-none block bg-transparent object-contain`}
      />
    </picture>
  );
}
