const SuccessCheckmark = () => (
  <div className="flex items-center justify-center">
    <svg className="w-16 h-16" viewBox="0 0 52 52">
      <circle
        className="animate-checkmark-circle"
        cx="26" cy="26" r="24"
        fill="none"
        stroke="hsl(var(--success))"
        strokeWidth="2"
      />
      <path
        className="animate-checkmark-draw"
        fill="none"
        stroke="hsl(var(--success))"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 27l7 7 16-16"
      />
    </svg>
  </div>
);

export default SuccessCheckmark;
