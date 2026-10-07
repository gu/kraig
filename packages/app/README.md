Welcome to your new TanStack Start app!

# Getting Started

To run this application:

```bash
pnpm install
pnpm dev
```

# External Data Sync

College football data (conferences, teams, games and betting lines) comes from the [CollegeFootballData API](https://collegefootballdata.com) and is stored in the `ext_*` tables. The sync CLI in `scripts/sync/` pulls that data into the database.

It requires `DATABASE_URL` and `CFBD_API_KEY` in `.env.local` or `.env`, and a migrated database (`pnpm migrate`).

```bash
pnpm sync-external-data                          # sync every table
pnpm sync-external-data -- games lines           # sync only some tables
pnpm sync-external-data -- --dry-run             # preview changes without committing them
pnpm sync-external-data -- teams --year 2025     # sync a different season
```

| Option              | Default      | Description                                      |
| ------------------- | ------------ | ------------------------------------------------ |
| `--year <year>`     | current year | Season to sync                                   |
| `--dry-run`         | off          | Fetch and diff, then roll back every change      |
| `--concurrency <n>` | `2`          | Max CFBD requests in flight at once              |
| `--interval <ms>`   | `250`        | Minimum delay between the start of CFBD requests |
| `-h`, `--help`      |              | Show usage                                       |

## How it works

- **Tables:** `conferences` → `teams` → `games` → `lines`. Selected tables always run in this order.
- **Scope:** each table is scoped by the tables before it, read from the database:
  - teams in the synced conferences;
  - games involving the synced teams;
  - lines for the synced games.

  This means a table can be synced on its own once the tables it depends on have been synced. If one of them is empty, the sync fails with an error saying which table to sync first.

- **Upserts:** rows are inserted or updated by primary key (`id`, or `(game_id, provider)` for lines), in one transaction per table.
- **Stale records are reported, never deleted.** Rows that are in the database but no longer returned by CFBD are listed in a report at the end of the run. Clean them up manually if needed. Deleting a game or team would cascade to users' `sheet_pick` rows. The `ext_*` tables don't store the season, so syncing a different `--year` reports the other season's rows as stale.
- **Rate limiting:** CFBD requests go through a throttle, controlled by `--concurrency` and `--interval`. Failed requests (429 and 5xx) are retried up to 5 times with jittered backoff, honoring the `Retry-After` header.

## Adding a table

1. Add a syncer in `scripts/sync/syncers/` that fetches with `ctx.cfbd.get` / `ctx.cfbd.getMany` and returns `syncTable(ctx, { table, keys, rows })`.
2. Register it in the `Syncers` list in `scripts/sync/index.ts`, in dependency order.

# Testing

```bash
pnpm test         # run once
pnpm test:watch   # re-run on changes
```

Tests use [Vitest](https://vitest.dev) and live next to the code as `*.test.ts`. Vitest is configured in `vitest.config.ts`, separately from `vite.config.ts`, so tests don't load the app's TanStack Start and Tailwind plugins. Database tests run against an in-memory Postgres ([PGlite](https://pglite.dev)) with the app's migrations applied, so no database server is needed. CFBD calls are replaced with a fake client, so no API key or network is needed either.

# Building For Production

To build this application for production:

```bash
pnpm build
```

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.

### Removing Tailwind CSS

If you prefer not to use Tailwind CSS:

1. Remove the demo pages in `src/routes/demo/`
2. Replace the Tailwind import in `src/styles.css` with your own styles
3. Remove `tailwindcss()` from the plugins array in `vite.config.ts`
4. Remove `@tailwindcss/vite` and `tailwindcss` from `package.json`

## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing. Routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application just add a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from "@tanstack/react-router";
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you render `{children}` in the `shellComponent`.

Here is an example layout that includes a header:

```tsx
import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "My App" },
    ],
  }),
  shellComponent: ({ children }) => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
          </nav>
        </header>
        {children}
        <Scripts />
      </body>
    </html>
  ),
});
```

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).

## Server Functions

TanStack Start provides server functions that allow you to write server-side code that seamlessly integrates with your client components.

```tsx
import { createServerFn } from "@tanstack/react-start";

const getServerTime = createServerFn({
  method: "GET",
}).handler(async () => {
  return new Date().toISOString();
});

// Use in a component
function MyComponent() {
  const [time, setTime] = useState("");

  useEffect(() => {
    getServerTime().then(setTime);
  }, []);

  return <div>Server time: {time}</div>;
}
```

## API Routes

You can create API routes by using the `server` property in your route definitions:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";

export const Route = createFileRoute("/api/hello")({
  server: {
    handlers: {
      GET: () => json({ message: "Hello, World!" }),
    },
  },
});
```

## Data Fetching

There are multiple ways to fetch data in your application. You can use TanStack Query to fetch data from a server. But you can also use the `loader` functionality built into TanStack Router to load the data for a route before it's rendered.

For example:

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/people")({
  loader: async () => {
    const response = await fetch("https://swapi.dev/api/people");
    return response.json();
  },
  component: PeopleComponent,
});

function PeopleComponent() {
  const data = Route.useLoaderData();
  return (
    <ul>
      {data.results.map((person) => (
        <li key={person.name}>{person.name}</li>
      ))}
    </ul>
  );
}
```

Loaders simplify your data fetching logic dramatically. Check out more information in the [Loader documentation](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#loader-parameters).

# Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).

For TanStack Start specific documentation, visit [TanStack Start](https://tanstack.com/start).
