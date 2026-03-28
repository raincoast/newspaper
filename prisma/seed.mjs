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
    // Konstanz · Jacob-Burckhardt-Straße — OSM 建筑 Sonnenbühl West I 门牌 4，近邻坐标沿街道推算至与瓦片上门牌对齐
    const jbs4 = { lat: 47.6815884, lng: 9.184665 }
    const jbs2 = { lat: 47.681628, lng: 9.184318 }
    const jbs6 = { lat: 47.681552, lng: 9.185028 }
    await prisma.houseMarker.createMany({
      data: [
        {
          regionId: demoRegion.id,
          street_name: "Jacob-Burckhardt-Straße",
          osm_default_housenumber: "2",
          current_housenumber: "2",
          delivery_status: "NOT_DELIVERED",
          building_id: "building_A_1",
          lat: jbs2.lat,
          lng: jbs2.lng
        },
        {
          regionId: demoRegion.id,
          street_name: "Jacob-Burckhardt-Straße",
          osm_default_housenumber: "4",
          current_housenumber: "4",
          delivery_status: "DELIVERED",
          building_id: "building_A_1",
          lat: jbs4.lat,
          lng: jbs4.lng
        },
        {
          regionId: demoRegion.id,
          street_name: "Jacob-Burckhardt-Straße",
          osm_default_housenumber: "6",
          current_housenumber: "6",
          delivery_status: "NO_ADVERTISE",
          building_id: "building_A_2",
          lat: jbs6.lat,
          lng: jbs6.lng
        }
      ]
    })
  }

  if (regionB) {
    await prisma.houseMarker.deleteMany({ where: { regionId: regionB.id } })
    const kbLat = 47.6641
    const kbLng = 9.1728
    await prisma.houseMarker.createMany({
      data: [
        {
          regionId: regionB.id,
          street_name: "Kreuzlinger Strasse",
          osm_default_housenumber: "10",
          current_housenumber: "10",
          delivery_status: "NOT_DELIVERED",
          building_id: "building_B_1",
          lat: kbLat,
          lng: kbLng
        },
        {
          regionId: regionB.id,
          street_name: "Kreuzlinger Strasse",
          osm_default_housenumber: "12",
          current_housenumber: "12",
          delivery_status: "NOT_DELIVERED",
          building_id: "building_B_1",
          lat: kbLat - 0.0004,
          lng: kbLng + 0.00035
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

