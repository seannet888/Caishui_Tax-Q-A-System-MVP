import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

export default function Loading() {
  return (
    <div className="flex h-full items-center justify-center">
      <LoadingSpinner />
    </div>
  );
}
