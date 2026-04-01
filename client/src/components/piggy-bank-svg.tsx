import img0 from "@assets/IMG_2062_1773846070998.PNG";
import img1 from "@assets/IMG_0610_1773846070999.PNG";
import img2 from "@assets/IMG_0611_1773846070999.PNG";
import img3 from "@assets/IMG_0612_1773846070999.PNG";
import img4 from "@assets/IMG_0613_1773846070999.PNG";
import img5 from "@assets/IMG_0614_1773846070999.PNG";

interface Props {
  coins: number;
  className?: string;
}

function getImage(coins: number): string {
  if (coins >= 46) return img5;
  if (coins >= 31) return img4;
  if (coins >= 16) return img3;
  if (coins >= 7) return img2;
  if (coins >= 1) return img1;
  return img0;
}

export function PiggyBankPreloader() {
  return (
    <div style={{ display: "none" }} aria-hidden="true">
      {[img0, img1, img2, img3, img4, img5].map((src, i) => (
        <img key={i} src={src} alt="" />
      ))}
    </div>
  );
}

export function PiggyBankSVG({ coins, className }: Props) {
  return (
    <img
      src={getImage(coins)}
      alt="piggy bank"
      width={230}
      height={230}
      style={{ width: 230, height: 230, objectFit: "contain" }}
      draggable={false}
      className={className}
    />
  );
}
