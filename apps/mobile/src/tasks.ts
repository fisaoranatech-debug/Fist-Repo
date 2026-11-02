/**
 * Tâches exécutées en arrière-plan, même quand l'application est fermée.
 * Ce fichier est importé en premier (index.ts).
 */
import * as BackgroundTask from "expo-background-task";
import type * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { sync } from "./agent";
import { TASKS } from "./config";

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TASKS.location, async ({ data, error }) => {
  if (error) return;
  await sync({ reason: "location", locations: data?.locations ?? [] });
});

TaskManager.defineTask(TASKS.background, async () => {
  try {
    await sync({ reason: "background", forceLocate: true });
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

// Notification push silencieuse envoyée par le serveur quand une commande attend.
TaskManager.defineTask(TASKS.notification, async () => {
  await sync({ reason: "push" });
});

export async function registerPushTask(): Promise<void> {
  if (!(await TaskManager.isTaskRegisteredAsync(TASKS.notification))) {
    await Notifications.registerTaskAsync(TASKS.notification).catch(() => {});
  }
}
