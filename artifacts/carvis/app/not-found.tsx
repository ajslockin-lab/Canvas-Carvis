import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center font-mono">
      <div className="text-center space-y-4">
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
          CARVIS // ERROR
        </p>
        <h1 className="text-6xl font-bold text-primary">404</h1>
        <p className="text-muted-foreground text-sm uppercase tracking-wider">
          Signal lost — sector not found
        </p>
        <Link
          href="/"
          className="inline-block mt-4 px-6 py-3 border border-primary text-primary text-xs uppercase tracking-widest hover:bg-primary hover:text-primary-foreground transition-colors"
        >
          Return to Base
        </Link>
      </div>
    </div>
  );
}
