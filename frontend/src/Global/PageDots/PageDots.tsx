import '../page_dots.css'

type PageDotsProps = {
  count: number
  activeIndex: number
  onSelect: (index: number) => void
  ariaLabel: string
}

export function PageDots({ count, activeIndex, onSelect, ariaLabel }: PageDotsProps) {
  return (
    <div className="carousel-dots" aria-label={ariaLabel}>
      {Array.from({ length: count }).map((_, dotIndex) => (
        <button
          key={dotIndex}
          type="button"
          className={dotIndex === activeIndex ? 'dot active' : 'dot'}
          onClick={() => onSelect(dotIndex)}
          aria-label={`Slide ${dotIndex + 1}`}
        />
      ))}
    </div>
  )
}
