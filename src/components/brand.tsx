import Link from "next/link";
import Image from "next/image";
export function Brand() {
  return (
    <div className="brand-group">
      <Link href="/" className="brand">
        <span className="brand-emblem" aria-hidden="true">
          <Image
            className="emblem-light"
            src="/brand/emblem-light.png"
            width={44}
            height={44}
            alt=""
            priority
          />
        </span>
        <span>
          mon enfant
          <span className="brand-sub">Le carnet qui grandit avec lui</span>
          <span className="sr-only"> — Accueil</span>
        </span>
      </Link>
    </div>
  );
}
