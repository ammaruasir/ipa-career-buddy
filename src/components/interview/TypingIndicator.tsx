const TypingIndicator = () => (
  <div className="flex items-center gap-1 px-2 py-1">
    <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce-dot" style={{ animationDelay: "0ms" }} />
    <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce-dot" style={{ animationDelay: "150ms" }} />
    <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce-dot" style={{ animationDelay: "300ms" }} />
  </div>
);

export default TypingIndicator;
