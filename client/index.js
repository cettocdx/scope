import { registerRootComponent } from "expo";

// Background tasks must be defined before the app renders.
import "@/lib/price-alerts";
import App from "@/App";

registerRootComponent(App);
