import Link from "next/link";

export default function NotFound() {
  return (
    <section className="container-ep py-24 md:py-40">
      <p className="text-sm font-semibold text-steel-dark">404</p>
      <h1 className="display mt-4 text-[56px] md:text-[128px]">Not on the rack.</h1>
      <p className="mt-4 max-w-md text-lg text-steel-dark">This page or product isn&apos;t available any more. Here&apos;s what is.</p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/drops" className="btn btn-volt">
          See the drop
        </Link>
        <Link href="/shop" className="btn btn-outline">
          Shop all
        </Link>
      </div>
    </section>
  );
}
