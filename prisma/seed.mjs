import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function upsertDemoUser({ email, name, password, role }) {
  const passwordHash = await bcrypt.hash(password, 10)

  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      passwordHash,
      role
    },
    update: {
      name,
      passwordHash,
      role
    }
  })
}

async function main() {
  await upsertDemoUser({
    email: "demo.admin@example.com",
    name: "Demo Admin",
    password: "Admin1234!",
    role: "admin"
  })

  await upsertDemoUser({
    email: "demo.courier@example.com",
    name: "Demo Courier",
    password: "Courier1234!",
    role: "courier"
  })

  // Seed demo regions + assignments
  const admin = await prisma.user.findUnique({
    where: { email: "demo.admin@example.com" }
  })
  const courier = await prisma.user.findUnique({
    where: { email: "demo.courier@example.com" }
  })

  if (!admin || !courier) {
    throw new Error("Demo users not found after upsert.")
  }

  const DEMO_REGION_NAME = "Demo · Konstanz (Jacob-Burckhardt-Straße)"

  let demoRegion = await prisma.region.findFirst({
    where: { OR: [{ name: DEMO_REGION_NAME }, { name: "投递区 A" }] }
  })
  if (!demoRegion) {
    demoRegion = await prisma.region.create({
      data: { name: DEMO_REGION_NAME, isPublicDemo: true }
    })
  } else {
    demoRegion = await prisma.region.update({
      where: { id: demoRegion.id },
      data: { name: DEMO_REGION_NAME, isPublicDemo: true }
    })
  }

  let regionB = await prisma.region.findFirst({ where: { name: "投递区 B" } })
  if (!regionB) {
    regionB = await prisma.region.create({
      data: { name: "投递区 B", isPublicDemo: false }
    })
  } else if (regionB.isPublicDemo) {
    regionB = await prisma.region.update({
      where: { id: regionB.id },
      data: { isPublicDemo: false }
    })
  }

  const regions = [demoRegion, regionB]

  for (const region of regions) {
    const adminAssign = await prisma.userRegionAssignment.findFirst({
      where: { userId: admin.id, regionId: region.id }
    })
    if (!adminAssign) {
      await prisma.userRegionAssignment.create({
        data: { userId: admin.id, regionId: region.id }
      })
    }

    if (region.id === demoRegion.id) {
      const courierAssign = await prisma.userRegionAssignment.findFirst({
        where: { userId: courier.id, regionId: region.id }
      })
      if (!courierAssign) {
        await prisma.userRegionAssignment.create({
          data: { userId: courier.id, regionId: region.id }
        })
      }
    }
  }

  if (demoRegion) {
    await prisma.houseMarker.deleteMany({ where: { regionId: demoRegion.id } })
  }

  if (regionB) {
    await prisma.houseMarker.deleteMany({ where: { regionId: regionB.id } })
  }

  console.log("Seed complete: demo users + regions + assignments（无默认门牌，请自行添加）。")
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

