/** 配送相关设置：courier 与 admin 同级（读写字段、区域、规则等） */
export function isDeliveryStaff(role: string | undefined): boolean {
  return role === "admin" || role === "courier"
}
