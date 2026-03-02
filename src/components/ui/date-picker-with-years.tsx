import * as React from "react";
import { format, setMonth, setYear } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DatePickerWithYearsProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  minAge?: number;
  maxAge?: number;
  placeholder?: string;
  className?: string;
}

const arabicMonths = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const DatePickerWithYears = ({
  value,
  onChange,
  minAge = 16,
  maxAge = 80,
  placeholder = "اختر التاريخ",
  className,
}: DatePickerWithYearsProps) => {
  const today = new Date();
  const maxDate = new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate());
  const minDate = new Date(today.getFullYear() - maxAge, 0, 1);

  const startYear = today.getFullYear() - maxAge;
  const endYear = today.getFullYear() - minAge;
  const years = React.useMemo(
    () => Array.from({ length: endYear - startYear + 1 }, (_, i) => endYear - i),
    [startYear, endYear]
  );

  const [calendarMonth, setCalendarMonth] = React.useState<Date>(value || new Date(endYear, 0, 1));

  const handleYearChange = (yearStr: string) => {
    const y = parseInt(yearStr);
    const newDate = setYear(calendarMonth, y);
    setCalendarMonth(newDate);
  };

  const handleMonthChange = (monthStr: string) => {
    const m = parseInt(monthStr);
    const newDate = setMonth(calendarMonth, m);
    setCalendarMonth(newDate);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-right font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="ml-2 h-4 w-4" />
          {value ? format(value, "yyyy/MM/dd") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
        <div className="flex gap-2 p-3 pb-0">
          <Select
            value={calendarMonth.getFullYear().toString()}
            onValueChange={handleYearChange}
          >
            <SelectTrigger className="w-[100px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[200px]">
              {years.map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={calendarMonth.getMonth().toString()}
            onValueChange={handleMonthChange}
          >
            <SelectTrigger className="w-[100px] h-8 text-xs">
              <SelectValue>
                {arabicMonths[calendarMonth.getMonth()]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {arabicMonths.map((m, i) => (
                <SelectItem key={i} value={i.toString()}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          month={calendarMonth}
          onMonthChange={setCalendarMonth}
          disabled={(date) => date > maxDate || date < minDate}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
};

export { DatePickerWithYears };
