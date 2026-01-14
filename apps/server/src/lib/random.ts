export function randomNumber(max: number) {
  return Math.floor(Math.random() * (max + 1))
}

export function randomFrom<T>(list: T[]): T {
  return list[randomNumber(list.length - 1)]
}

export function randomsFrom<T>(list: T[], count: number) {
  const used: number[] = []

  for (let i = 0; i < count; i++) {
    let random = randomNumber(list.length - 1)
    while (used.includes(random)) {
      random = randomNumber(list.length - 1)
    }
    used.push(random)
  }

  return used.map((u) => list[u])
}
