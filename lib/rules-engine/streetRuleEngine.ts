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

function inNumericRange(houseN: number, rule: StreetRuleLike): boolean {
  if (rule.fromNumber != null && houseN < rule.fromNumber) return false
  if (rule.toNumber != null && houseN > rule.toNumber) return false
  return true
}

/** 单条规则核心逻辑（不含手动添加/排除） */
export function evaluateStreetRuleCore(rule: StreetRuleLike, house: HouseMarkerLike): boolean {
  const houseValue = effectiveHouseNumber(house)
  const houseN = parseLeadingInteger(houseValue)

  switch (rule.ruleType) {
    case "all": {
      const hasBounds = rule.fromNumber != null || rule.toNumber != null
      if (!hasBounds) return true
      return houseN !== null && inNumericRange(houseN, rule)
    }
    case "odd": {
      if (houseN === null) return false
      const hasBounds = rule.fromNumber != null || rule.toNumber != null
      if (hasBounds && !inNumericRange(houseN, rule)) return false
      return houseN % 2 === 1
    }
    case "even": {
      if (houseN === null) return false
      const hasBounds = rule.fromNumber != null || rule.toNumber != null
      if (hasBounds && !inNumericRange(houseN, rule)) return false
      return houseN % 2 === 0
    }
    case "from_number":
      if (houseN === null || rule.fromNumber == null) return false
      if (houseN < rule.fromNumber) return false
      if (rule.toNumber != null && houseN > rule.toNumber) return false
      return true
    case "to_number":
      if (houseN === null || rule.toNumber == null) return false
      if (houseN > rule.toNumber) return false
      if (rule.fromNumber != null && houseN < rule.fromNumber) return false
      return true
    case "include_numbers":
      return matchesInclude(rule, houseValue)
    case "exclude_numbers":
      return !matchesExclude(rule, houseValue)
    default: {
      const _exhaustive: never = rule.ruleType
      return _exhaustive
    }
  }
}

export function evaluateStreetRuleSelection({
  rule,
  house
}: {
  rule: StreetRuleLike
  house: HouseMarkerLike
}) {
  if (house.isManuallyExcluded) return false
  if (house.isManuallyAdded) return true
  return evaluateStreetRuleCore(rule, house)
}

/** 同一条街多条规则取并集（OR）；无规则时无人被选中 */
export function evaluateStreetRulesUnion(rules: StreetRuleLike[], house: HouseMarkerLike): boolean {
  if (house.isManuallyExcluded) return false
  if (house.isManuallyAdded) return true
  if (rules.length === 0) return false
  return rules.some((r) => evaluateStreetRuleCore(r, house))
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

