import { DemoPresenter } from "./DemoPresenter";
import { DemoSpotlight } from "./DemoSpotlight";

export function DemoOverlay() {
  return (
    <>
      <DemoSpotlight />
      <DemoPresenter />
    </>
  );
}
