import Image from "next/image";

export function ChildAvatar({
  sex,
  authorizedPhotoSrc,
  size = 48,
}: {
  sex: string | null | undefined;
  authorizedPhotoSrc?: string | null;
  size?: number;
}) {
  const illustration =
    sex === "male" ? "boy" : sex === "female" ? "girl" : "neutral";

  return (
    <Image
      className="clinician-child-avatar"
      src={
        authorizedPhotoSrc ||
        `/dashboard-art/registry-avatar-${illustration}.webp`
      }
      width={size}
      height={size}
      alt=""
      unoptimized
    />
  );
}
