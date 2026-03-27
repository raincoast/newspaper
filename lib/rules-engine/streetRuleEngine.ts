export type StreetRuleType =
  | "all"
  | "odd"
  | "even"
  | "from_number"
  | "to_number"
  | "include_numbers"
  | "exclude_numbers"

export type StreetRuleLike = {
  ruleType: StreetRuleType
  fromNumber?: number | null
  toNumber?: number | null
  includeNumbers?: string[] | null
  excludeNumbers?: string[] | null
}

export type HouseMarkerLike = {
  osmDefaultHousenumber: string
  currentHousenumber: string
  isNumberOverridden: boolean
  isManuallyAdded: boolean
  isManuallyExcluded: boolean
}

function normalizeHouseNumber(n: string) {
  return n.trim().replace(/\s+/g, "")
}

function parseLeadingInteger(n: string): number | null {
  const normalized = normalizeHouseNumber(n)
  const match = normalized.match(/^(\d+)/)
  if (!match) return null
  const value = Number(match[1])
  if (Number.isNaN(value)) return null
  return value
}

function effectiveHouseNumber(house: HouseMarkerLike) {
  return house.isNumberOverridden
    ? house.currentHousenumber
    : house.osmDefaultHousenumber
}

function matchesByExactOrLeadingNumber({
  houseValue,
  ruleValues
}: {
  houseValue: string
  ruleValues: string[]
}) {
  const normalizedHouse = normalizeHouseNumber(houseValue)
  const normalizedRuleValues = ruleValues.map((v) => normalizeHouseNumber(v))
  if (normalizedRuleValues.includes(normalizedHouse)) return true

  const houseN = parseLeadingInteger(normalizedHouse)
  if (houseN === null) return false

  for (const v of normalizedRuleValues) {
    const n = parseLeadingInteger(v)
    if (n !== null && n === houseN) return true
  }
  return false
}

function matchesInclude(rule: StreetRuleLike, houseValue: string) {
  const includeNumbers = rule.includeNumbers ?? []
  if (includeNumbers.length === 0) return false
  return matchesByExactOrLeadingNumber({
    houseValue,
    ruleValues: includeNumbers
  })
}

function matchesExclude(rule: StreetRuleLike, houseValue: string) {
  const excludeNumbers = rule.excludeNumbers ?? []
  if (excludeNumbers.length === 0) return false
  return matchesByExactOrLeadingNumber({
    houseValue,
    ruleValues: excludeNumbers
  })
}

export function evaluateStreetRuleSelection({
  rule,
  house
}: {
  rule: StreetRuleLike
  house: HouseMarkerLike
}) {
  // 手动优先级：排除 > 规则 > 手动添加
  if (house.isManuallyExcluded) return false
  if (house.isManuallyAdded) return true

  const houseValue = effectiveHouseNumber(house)
  const houseN = parseLeadingInteger(houseValue)

  switch (rule.ruleType) {
    case "all":
      return true
    case "odd":
      return houseN !== null && houseN % 2 === 1
    case "even":
      return houseN !== null && houseN % 2 === 0
    case "from_number":
      return (
        houseN !== null &&
        rule.fromNumber !== null &&
        rule.fromNumber !== undefined &&
        houseN >= rule.fromNumber
      )
    case "to_number":
      return (
        houseN !== null &&
        rule.toNumber !== null &&
        rule.toNumber !== undefined &&
        houseN <= rule.toNumber
      )
    case "include_numbers":
      return matchesInclude(rule, houseValue)
    case "exclude_numbers":
      return !matchesExclude(rule, houseValue)
    default: {
      // Exhaustiveness check
      const _exhaustive: never = rule.ruleType
      return _exhaustive
    }
  }
}

export function toStreetRuleLikeFromPrisma(rule: {
  rule_type: StreetRuleType
  from_number: number | null
  to_number: number | null
  include_numbers: string[]
  exclude_numbers: string[]
}): StreetRuleLike {
  return {
    ruleType: rule.rule_type,
    fromNumber: rule.from_number,
    toNumber: rule.to_number,
    includeNumbers: rule.include_numbers,
    excludeNumbers: rule.exclude_numbers
  }
}

export function toHouseMarkerLikeFromPrisma(house: {
  osm_default_housenumber: string
  current_housenumber: string
  is_number_overridden: boolean
  is_manually_added: boolean
  is_manually_excluded: boolean
}): HouseMarkerLike {
  return {
    osmDefaultHousenumber: house.osm_default_housenumber,
    currentHousenumber: house.current_housenumber,
    isNumberOverridden: house.is_number_overridden,
    isManuallyAdded: house.is_manually_added,
    isManuallyExcluded: house.is_manually_excluded
  }
}

