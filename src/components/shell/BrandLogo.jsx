/** Isotipo de Argentina Color. `plain`: solo el símbolo blanco (para fondos oscuros). */
export function BrandLogo({ size = 28, plain = false }) {
  const symbol = plain ? "#FFFFFF" : "#FAFAFA";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Argentina Color"
    >
      {!plain && (
        <rect
          x="0.5"
          y="0.5"
          width="27"
          height="27"
          rx="5.5"
          className="fill-brand-600 dark:fill-brand-700"
        />
      )}
      <path
        d="M11.7508 14.0691C9.48988 10.8864 8.736 13.1141 8.62686 14.4634C8.51705 15.8209 7.76229 16.1444 7.37954 16.7578C5.7504 18.6121 6.10668 20.2234 6.7346 21.1075C9.2244 23.8921 12.3742 21.9253 13.1793 20.3464C14.2001 18.2694 12.6368 15.1963 11.7508 14.0691Z"
        fill={symbol}
      />
      <path
        d="M11.0208 10.819C9.47181 9.66482 9.58786 7.13258 11.3803 6.41143C12.1938 6.08412 13.1265 6.25722 13.7546 6.86889C18.2582 11.2549 20.1327 14.2741 20.9225 20.2317C21.0207 20.9722 20.6914 21.7021 20.0872 22.1419C18.5496 23.2611 16.3309 21.8886 16.2143 19.9912C15.9687 15.9944 14.2022 13.1895 11.0208 10.819Z"
        fill={symbol}
      />
    </svg>
  );
}
