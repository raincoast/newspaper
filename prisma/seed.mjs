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

  const regionNames = ["投递区 A", "投递区 B"]
  const regions = []

  for (const n of regionNames) {
    let region = await prisma.region.findFirst({ where: { name: n } })
    if (!region) {
      region = await prisma.region.create({ data: { name: n } })
    }
    regions.push(region)
  }

  for (const region of regions) {
    const adminAssign = await prisma.userRegionAssignment.findFirst({
      where: { userId: admin.id, regionId: region.id }
    })
    if (!adminAssign) {
      await prisma.userRegionAssignment.create({
        data: { userId: admin.id, regionId: region.id }
      })
    }

    // courier 先只分配到 A（MVP 演示“只能切换已分配区域”）
    if (region.name === "投递区 A") {
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

  // Seed demo house markers for map layer demo
  const regionA = regions.find((r) => r.name === "投递区 A")
  const regionB = regions.find((r) => r.name === "投递区 B")

  if (regionA) {
    await prisma.houseMarker.deleteMany({ where: { regionId: regionA.id } })
    await prisma.houseMarker.createMany({
      data: [
        {
          regionId: regionA.id,
          street_name: "和平路",
          osm_default_housenumber: "1",
          current_housenumber: "1",
          delivery_status: "NOT_DELIVERED",
          building_id: "building_A_1",
          lat: 39.9085,
          lng: 116.3978
        },
        {
          regionId: regionA.id,
          street_name: "和平路",
          osm_default_housenumber: "3",
          current_housenumber: "3",
          delivery_status: "DELIVERED",
          building_id: "building_A_1",
          lat: 39.9092,
          lng: 116.3989
        },
        {
          regionId: regionA.id,
          street_name: "和平路",
          osm_default_housenumber: "5",
          current_housenumber: "5",
          delivery_status: "NO_ADVERTISE",
          building_id: "building_A_2",
          lat: 39.9079,
          lng: 116.3992
        }
      ]
    })
  }

  if (regionB) {
    await prisma.houseMarker.deleteMany({ where: { regionId: regionB.id } })
    await prisma.houseMarker.createMany({
      data: [
        {
          regionId: regionB.id,
          street_name: "建设街",
          osm_default_housenumber: "2",
          current_housenumber: "2",
          delivery_status: "NOT_DELIVERED",
          building_id: "building_B_1",
          lat: 39.9132,
          lng: 116.4042
        },
        {
          regionId: regionB.id,
          street_name: "建设街",
          osm_default_housenumber: "4",
          current_housenumber: "4",
          delivery_status: "NOT_DELIVERED",
          building_id: "building_B_1",
          lat: 39.9126,
          lng: 116.4054
        }
      ]
    })
  }

  console.log("Seed complete: demo users + regions + assignments ready.")
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

