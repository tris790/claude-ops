import { MainLayout } from "./layouts/MainLayout";
import { Button } from "./components/ui/Button";
import { Card } from "./components/ui/Card";
import { Input } from "./components/ui/Input";
import { Badge } from "./components/ui/Badge";
import { Spinner } from "./components/ui/Spinner";

export function App() {
  return (
    <MainLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Design System</h1>
          <p className="text-zinc-400">Foundation components and layout verification.</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-zinc-100">Buttons</h2>
          <div className="flex flex-wrap gap-4">
            <Button variant="primary">Primary Action</Button>
            <Button variant="secondary">Secondary Action</Button>
            <Button variant="ghost">Ghost Button</Button>
            <Button variant="danger">Destructive</Button>
            <Button isLoading>Loading</Button>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-zinc-100">Inputs</h2>
          <div className="grid max-w-md gap-4">
            <Input label="Email Address" placeholder="name@example.com" />
            <Input label="Password" type="password" defaultValue="secret" error="Password matches previous password" />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-zinc-100">Cards & Badges</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card hoverable className="space-y-3">
              <div className="flex justify-between items-start">
                <h3 className="font-medium text-white">Pull Request #42</h3>
                <Badge variant="success">Open</Badge>
              </div>
              <p className="text-sm text-zinc-400">Refactoring the navigation component for better accessibility.</p>
              <div className="text-xs text-zinc-500">Updated 2h ago</div>
            </Card>
            <Card className="space-y-3">
              <div className="flex justify-between items-start">
                <h3 className="font-medium text-white">Issue #128</h3>
                <Badge variant="warning">Blocked</Badge>
              </div>
              <p className="text-sm text-zinc-400">Waiting on API documentation update.</p>
              <div className="flex items-center gap-2 text-xs text-zinc-500 border-t border-zinc-800/50 pt-3">
                <Spinner size="sm" />
                <span>Syncing...</span>
              </div>
            </Card>
          </div>
        </section>
      </div>
    </MainLayout>
  );
}

export default App;
