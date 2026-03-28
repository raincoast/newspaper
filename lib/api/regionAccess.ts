import { prisma } from "../prisma/client"

export async function isPublicDemoRegion(regionId: string): Promise<boolean> {
  const r = await prisma.region.findUnique({
    where: { id: regionId },
    select: { isPublicDemo: true }
  })
  return Boolean(r?.isPublicDemo)
}

export async function canCourierAccessRegion(
  userId: string,
  regionId: string
): Promise<boolean> {
  const a = await prisma.userRegionAssignment.findUnique({
    where: { userId_regionId: { userId, regionId } }
  })
  return Boolean(a)
}
