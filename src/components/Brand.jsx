export function Brand({ subtitle = "Your college path, made clearer" }) {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true">X</span>
      <span>
        <span className="brand-name">Xlore U</span>
        <span className="brand-subtitle">{subtitle}</span>
      </span>
    </span>
  );
}
