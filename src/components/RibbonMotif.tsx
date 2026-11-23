interface RibbonDividerProps {
  className?: string;
}

/**
 * Signature Hoa Nelly brand motif: a fine-line balloon ribbon & bow knot
 * used selectively as an editorial chapter divider.
 */
export function RibbonDivider({ className = '' }: RibbonDividerProps) {
  return (
    <div
      className={`flex items-center justify-center py-2 select-none ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 320 26"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-64 sm:w-80 h-6 text-[#0297DE]/70"
      >
        <path
          className="hn-ribbon-stroke"
          d="M4 13C46 13 68 18 118 13C134 11.4 146 11.5 156 13"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
        <path
          className="hn-ribbon-stroke"
          d="M164 13C174 11.5 186 11.4 202 13C252 18 274 13 316 13"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
        {/* Delicate balloon-ribbon knot at center in restrained pink #D83995 */}
        <path
          d="M160 13C156 7 148 6 146.5 10.5C145.5 13.5 151.5 15.5 160 13Z"
          className="hn-ribbon-pink"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M160 13C164 7 172 6 173.5 10.5C174.5 13.5 168.5 15.5 160 13Z"
          className="hn-ribbon-pink"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M159.2 13.6C157 17.5 154.5 21 152 23.5"
          className="hn-ribbon-pink"
          strokeOpacity="0.72"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path
          d="M160.8 13.6C163 17.5 165.5 21 168 23.5"
          className="hn-ribbon-pink"
          strokeOpacity="0.72"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
