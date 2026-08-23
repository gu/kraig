import { Button } from "@/components/ui/button";

interface CtaSimpleProps {
  heading: string;
  description: string;
  buttons?: ReturnType<typeof Button>[];
}

interface Cta34Props extends CtaSimpleProps {}
type Props = Partial<Cta34Props>;

const defaultProps: Cta34Props = {
  heading: "Call to Action",
  description: "Get access to our collection of pre-built blocks and components today.",
  buttons: [],
};

const Cta34 = (props: Props) => {
  const { heading, description, buttons } = {
    ...defaultProps,
    ...props,
  };

  return (
    <section className="py-16">
      <div className="container mx-auto">
        <div className="border-t pt-14">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center">
            <h2 className="text-2xl font-semibold tracking-tight md:text-4xl">{heading}</h2>
            <p className="max-w-2xl text-muted-foreground lg:text-lg">{description}</p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">{buttons}</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export { Cta34 };
