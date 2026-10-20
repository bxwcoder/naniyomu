// 「あなたの回答と合っている点」を短いラベルで並べる部品

export function HighlightList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="highlights" aria-label="おすすめする理由">
      <h2 className="visually-hidden">あなたの回答と合っている点</h2>
      <ul>
        {items.map((h) => (
          <li key={h}>
            <span aria-hidden="true">✓ </span>
            {h}
          </li>
        ))}
      </ul>
    </section>
  );
}
