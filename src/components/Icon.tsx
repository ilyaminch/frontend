export function Icon({ name, size = 15 }: { name: string; size?: number }) {
  return <span className="icon" style={{ width: size, height: size }} aria-hidden="true"><img src={`/assets/${name}.svg`} alt="" /></span>
}
