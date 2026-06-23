import {
  CheckCircle2,
  Circle,
  Clock,
} from "lucide-react"

export const statuses = [
  {
    value: "BORROWING",
    label: "Đang mượn",
    icon: Clock,
  },
  {
    value: "OVERDUE",
    label: "Quá hạn",
    icon: Circle,
  },
  {
    value: "RETURNED",
    label: "Đã trả",
    icon: CheckCircle2,
  },
]
