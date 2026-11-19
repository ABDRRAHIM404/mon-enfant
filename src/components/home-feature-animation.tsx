import Image from "next/image";

export function HomeFeatureAnimation({
  name,
  description,
}: {
  name: string;
  description: string;
}) {
  const asset = `/brand/demo-${name}`;
  return (
    <figure>
      <picture className="home-feature-media">
        <source
          media="(prefers-reduced-motion: reduce)"
          srcSet={`${asset}.webp`}
          type="image/webp"
        />
        <Image
          src={`${asset}.gif`}
          alt={description}
          width={640}
          height={384}
          unoptimized
        />
      </picture>
      <figcaption>{description}</figcaption>
    </figure>
  );
}
