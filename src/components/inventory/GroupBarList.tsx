import type { GroupBarItem } from "../../utils/inventoryStats";

interface GroupBarListProps {
  items: GroupBarItem[];
  onClick?: (key: number) => void;
}

export function GroupBarList({ items, onClick }: GroupBarListProps) {
  if (items.length === 0) {
    return <p className="text-xs text-inv-mut">No units in scope.</p>;
  }

  return (
    <div>
      {items.map((item) => {
        const total = item.total || 1;
        return (
          <div
            key={item.key}
            onClick={() => onClick?.(item.key)}
            className="mb-2.5 cursor-pointer last:mb-0"
          >
            <div className="mb-1 flex justify-between gap-2.5 text-[12.5px]">
              <span className="truncate whitespace-nowrap text-inv-ink">{item.label}</span>
              <span className="whitespace-nowrap text-inv-mut">
                {item.availablePercent.toFixed(0)}% avail · {item.total}
              </span>
            </div>
            <div className="flex h-[15px] overflow-hidden rounded-[3px] bg-inv-bg hover:outline hover:outline-2 hover:outline-inv-gold hover:outline-offset-1">
              <div className="bg-inv-available" style={{ width: `${(item.available / total) * 100}%` }} />
              <div className="bg-inv-booked" style={{ width: `${(item.booked / total) * 100}%` }} />
              <div className="bg-inv-mgmt" style={{ width: `${(item.management / total) * 100}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
