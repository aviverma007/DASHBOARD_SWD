interface AvailabilityBarRowProps {
  name: string;
  available: number;
  booked: number;
  management: number;
  onClick?: () => void;
}

export function AvailabilityBarRow({
  name,
  available,
  booked,
  management,
  onClick,
}: AvailabilityBarRowProps) {
  const total = available + booked + management || 1;
  const availablePercent = ((available / total) * 100).toFixed(0);

  return (
    <div onClick={onClick} className="mb-2.5 cursor-pointer last:mb-0">
      <div className="mb-1 flex justify-between gap-2.5 text-[12.5px]">
        <span className="overflow-hidden truncate whitespace-nowrap text-inv-ink">{name}</span>
        <span className="whitespace-nowrap text-inv-mut">
          {availablePercent}% avail · {available} units
        </span>
      </div>
      <div className="group flex h-[15px] overflow-hidden rounded-[3px] bg-inv-bg hover:outline hover:outline-2 hover:outline-inv-gold hover:outline-offset-1">
        <div
          className="bg-inv-available"
          style={{ width: `${(available / total) * 100}%` }}
        />
        <div className="bg-inv-booked" style={{ width: `${(booked / total) * 100}%` }} />
        <div className="bg-inv-mgmt" style={{ width: `${(management / total) * 100}%` }} />
      </div>
    </div>
  );
}

interface ValueBarRowProps {
  name: string;
  value: string; // formatted currency
  widthPercent: number;
  onClick?: () => void;
}

export function ValueBarRow({ name, value, widthPercent, onClick }: ValueBarRowProps) {
  return (
    <div onClick={onClick} className="mb-2.5 cursor-pointer last:mb-0">
      <div className="mb-1 flex justify-between gap-2.5 text-[12.5px]">
        <span className="overflow-hidden truncate whitespace-nowrap text-inv-ink">{name}</span>
        <span className="whitespace-nowrap text-inv-mut">{value}</span>
      </div>
      <div className="h-[15px] rounded-[3px] bg-inv-gold opacity-90" style={{ width: `${widthPercent}%` }} />
    </div>
  );
}
