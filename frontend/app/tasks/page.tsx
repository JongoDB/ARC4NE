import { Suspense } from "react"
import { TasksPageContent } from "./tasks-content"

export default function TasksPage() {
  return (
    <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14 flex-1">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
        <h1 className="text-xl font-semibold">Tasks</h1>
      </header>
      <div className="p-4 sm:px-6 flex-1 overflow-auto">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Loading tasks...</p>
            </div>
          }
        >
          <TasksPageContent />
        </Suspense>
      </div>
    </div>
  )
}
