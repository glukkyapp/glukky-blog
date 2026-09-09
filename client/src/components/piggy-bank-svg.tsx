import background from "@assets/background_1788973267419.png";
import seedling from "@assets/seedling_1788972650982.png";
import smallTree from "@assets/small-tree_1788972650982.png";
import youngTree from "@assets/young-tree_1788972650983.png";
import completeTree from "@assets/complete-tree_1788972650981.png";
import flower1 from "@assets/flower1_1788972650982.png";
import flower2 from "@assets/flower2_1788972650982.png";
import flower3 from "@assets/flower3_1788972650982.png";
import flower4 from "@assets/flower4_1788972650982.png";
import bird from "@assets/bird_1788972650981.png";
import bench from "@assets/bench_1788972650981.png";
import lamp from "@assets/lamp_1788972650982.png";
import ferry from "@assets/ferry_1788972650982.png";
import {
  clampGardenPoints,
  getGardenLayerKeys,
  getGardenTree,
  renderOrder,
  type GardenLayer,
  type GardenTree,
} from "@/components/harbour-garden-state";

export { getGardenLayerKeys, getGardenTree, renderOrder };
export type { GardenLayer, GardenTree };

interface Props {
  coins: number;
  className?: string;
  ariaLabel?: string;
}

const staticSources: Partial<Record<GardenLayer, string>> = {
  background,
  flower1,
  flower2,
  bird,
  bench,
  lamp,
  flower3,
  ferry,
  flower4,
};

const treeSources: Record<GardenTree, string> = {
  seedling,
  "small-tree": smallTree,
  "young-tree": youngTree,
  "complete-tree": completeTree,
};

export function getGardenLayers(coins: number): Array<{ key: GardenLayer; src: string }> {
  const selectedTree = getGardenTree(coins);
  const layers: Array<{ key: GardenLayer; src: string }> = [];
  for (const key of getGardenLayerKeys(coins)) {
    if (key === "tree") {
      if (selectedTree) layers.push({ key, src: treeSources[selectedTree] });
      continue;
    }
    const src = staticSources[key];
    if (src) layers.push({ key, src });
  }
  return layers;
}

export function PiggyBankPreloader() {
  return (
    <div style={{ display: "none" }} aria-hidden="true">
      {[background, seedling, smallTree, youngTree, completeTree, flower1, flower2, bird, bench, lamp, flower3, ferry, flower4].map((src) => (
        <img key={src} src={src} alt="" />
      ))}
    </div>
  );
}

export function PiggyBankSVG({ coins, className, ariaLabel }: Props) {
  const points = clampGardenPoints(coins);
  return (
    <div
      className={`relative w-full overflow-hidden ${className ?? ""}`}
      style={{ aspectRatio: "1376 / 768" }}
      role="img"
      aria-label={ariaLabel ?? `Harbour Garden, ${points} of 60 garden points`}
      data-testid="harbour-garden"
    >
      {getGardenLayers(points).map(({ key, src }) => (
        <img
          key={key}
          src={src}
          alt=""
          draggable={false}
          data-garden-layer={key}
          className="absolute inset-0 h-full w-full object-contain"
        />
      ))}
    </div>
  );
}