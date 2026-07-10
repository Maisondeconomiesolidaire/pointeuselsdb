import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { frFR } from "@clerk/localizations";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { MissingConfig } from "./components/MissingConfig";
import "./index.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL;
const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const root = createRoot(document.getElementById("root")!);
const missing: string[] = [];
if (!convexUrl) missing.push("VITE_CONVEX_URL");
if (!clerkKey || clerkKey.includes("REMPLACER")) {
  missing.push("VITE_CLERK_PUBLISHABLE_KEY");
}

if (missing.length > 0) {
  root.render(
    <StrictMode>
      <MissingConfig missing={missing} />
    </StrictMode>,
  );
} else {
  const convex = new ConvexReactClient(convexUrl);
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <ClerkProvider
          publishableKey={clerkKey}
          localization={frFR}
          appearance={{ variables: { colorPrimary: "#ff7700" } }}
        >
          <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </ConvexProviderWithClerk>
        </ClerkProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}
