export default function Header() {
  return (
    <div className="flex flex-col gap-16 items-center">
      <h1 className="sr-only">Supabase and Next.js Starter Template</h1>
      <p className="text-3xl lg:text-4xl !leading-tight mx-auto max-w-xl text-center">
      A Data-Driven Approach to {" "}
        <span
          className="font-bold hover:underline"
        >
          Climate Change Awareness
        </span>
      </p>
      <div className="w-full p-[1px] bg-gradient-to-r from-transparent via-foreground/10 to-transparent my-8" />
    </div>
  );
}
