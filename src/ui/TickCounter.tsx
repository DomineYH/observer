export function TickCounter({ tick }: { tick: number }) {
  return (
    <p>
      틱 <output aria-label="틱">{tick}</output>
    </p>
  );
}
