import { expect } from 'chai'
import { Contract } from 'ethers'

import { assertEvent, deploy, ZERO_ADDRESS } from '../../..'

/* eslint-disable no-secrets/no-secrets */

describe('EnumerableMap', () => {
  let map: Contract

  const keyA = '0x8B40ECf815AC8d53aB4AD2a00248DE77296344Db'
  const keyB = '0x638141Eb8905D9A55D81610f45bC2B47120059e7'
  const keyC = '0x7571A57e94F046725612f786Aa9bf44ce6b56894'

  describe('AddressToUintMap', () => {
    const valueA = '10'
    const valueB = '20'
    const valueC = '30'

    beforeEach('deploy map', async () => {
      map = await deploy('EnumerableMapAddressToUintMock')
    })

    async function expectMembersMatch(keys, values) {
      expect(keys.length).to.equal(values.length)

      await Promise.all(keys.map(async (key) => expect(await map.contains(key)).to.equal(true)))

      expect(await map.length()).to.be.equal(keys.length)

      expect(
        (await Promise.all(keys.map((key) => map.get(key)))).map((value) => value.toString())
      ).to.have.same.members(values)

      await Promise.all(
        keys.map(async (key, index) => {
          const value = values[index]
          const entry = await map.at(index)
          expect(entry.key).to.be.equal(key)
          expect(entry.value).to.be.equal(value)
        })
      )

      expect(await map.keys()).to.have.same.members(keys)

      expect((await map.values()).map((value) => value.toString())).to.have.same.members(values)
    }

    it('starts empty', async () => {
      expect(await map.contains(keyA)).to.equal(false)

      await expectMembersMatch([], [])
    })

    describe('set', () => {
      it('adds a key', async () => {
        const tx = await map.set(keyA, valueA)
        await assertEvent(tx, 'OperationResult', { result: true })

        await expectMembersMatch([keyA], [valueA])
      })

      it('adds several keys', async () => {
        await map.set(keyA, valueA)
        await map.set(keyB, valueB)

        await expectMembersMatch([keyA, keyB], [valueA, valueB])
        expect(await map.contains(keyC)).to.equal(false)
      })

      it('returns false when adding keys already in the set', async () => {
        await map.set(keyA, valueA)

        const tx = await map.set(keyA, valueA)
        await assertEvent(tx, 'OperationResult', { result: false })

        await expectMembersMatch([keyA], [valueA])
      })

      it('updates values for keys already in the set', async () => {
        await map.set(keyA, valueA)

        await map.set(keyA, valueB)

        await expectMembersMatch([keyA], [valueB])
      })
    })

    describe('remove', () => {
      it('removes added keys', async () => {
        await map.set(keyA, valueA)

        const tx = await map.remove(keyA)
        await assertEvent(tx, 'OperationResult', { result: true })

        expect(await map.contains(keyA)).to.equal(false)
        await expectMembersMatch([], [])
      })

      it('returns false when removing keys not in the set', async () => {
        const tx = await map.remove(keyA)
        await assertEvent(tx, 'OperationResult', { result: false })

        expect(await map.contains(keyA)).to.equal(false)
      })

      it('adds and removes multiple keys', async () => {
        await map.set(keyA, valueA)
        await map.set(keyC, valueC)
        await expectMembersMatch([keyA, keyC], [valueA, valueC]) // [A, C]

        await map.remove(keyA)
        await map.remove(keyB)
        await expectMembersMatch([keyC], [valueC]) // [C]

        await map.set(keyB, valueB)
        await expectMembersMatch([keyC, keyB], [valueC, valueB]) // [C, B]

        await map.set(keyA, valueA)
        await map.remove(keyC)
        await expectMembersMatch([keyA, keyB], [valueA, valueB]) // [A, B]

        await map.set(keyA, valueA)
        await map.set(keyB, valueB)
        await expectMembersMatch([keyA, keyB], [valueA, valueB]) // [A, B]

        await map.set(keyC, valueC)
        await map.remove(keyA)
        await expectMembersMatch([keyC, keyB], [valueC, valueB]) // [C, B]

        await map.set(keyA, valueA)
        await map.remove(keyB)
        await expectMembersMatch([keyC, keyA], [valueC, valueA]) // [C, A]

        expect(await map.contains(keyB)).to.equal(false)
      })
    })

    describe('read', () => {
      beforeEach(async () => {
        await map.set(keyA, valueA)
      })

      describe('get', () => {
        it('existing value', async () => {
          expect((await map.get(keyA)).toString()).to.be.equal(valueA.toString())
        })

        it('missing value', async () => {
          await expect(map.get(keyB)).to.be.revertedWith('EnumerableMap: nonexistent key')
        })
      })

      describe('tryGet', () => {
        it('existing value', async () => {
          const { exists, value } = await map.tryGet(keyA)
          expect(exists).to.be.equal(true)
          expect(value).to.be.equal(valueA)
        })

        it('missing value', async () => {
          const { exists, value } = await map.tryGet(keyB)
          expect(exists).to.be.equal(false)
          expect(value).to.be.equal(ZERO_ADDRESS)
        })
      })
    })
  })

  describe('AddressToAddressMap', () => {
    const valueA = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
    const valueB = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
    const valueC = '0xf584F8728B874a6a5c7A8d4d387C9aae9172D621'

    beforeEach('deploy map', async () => {
      map = await deploy('EnumerableMapAddressToAddressMock')
    })

    async function expectMembersMatch(keys, values) {
      expect(keys.length).to.equal(values.length)

      await Promise.all(keys.map(async (key) => expect(await map.contains(key)).to.equal(true)))

      expect(await map.length()).to.be.equal(keys.length)

      expect(await Promise.all(keys.map((key) => map.get(key)))).to.have.same.members(values)

      await Promise.all(
        keys.map(async (key, index) => {
          const value = values[index]
          const entry = await map.at(index)
          expect(entry.key).to.be.equal(key)
          expect(entry.value).to.be.equal(value)
        })
      )

      expect(await map.keys()).to.have.same.members(keys)
      expect(await map.values()).to.have.same.members(values)
    }

    it('starts empty', async () => {
      expect(await map.contains(keyA)).to.equal(false)

      await expectMembersMatch([], [])
    })

    describe('set', () => {
      it('adds a key', async () => {
        const tx = await map.set(keyA, valueA)
        await assertEvent(tx, 'OperationResult', { result: true })

        await expectMembersMatch([keyA], [valueA])
      })

      it('adds several keys', async () => {
        await map.set(keyA, valueA)
        await map.set(keyB, valueB)

        await expectMembersMatch([keyA, keyB], [valueA, valueB])
        expect(await map.contains(keyC)).to.equal(false)
      })

      it('returns false when adding keys already in the set', async () => {
        await map.set(keyA, valueA)

        const tx = await map.set(keyA, valueA)
        await assertEvent(tx, 'OperationResult', { result: false })

        await expectMembersMatch([keyA], [valueA])
      })

      it('updates values for keys already in the set', async () => {
        await map.set(keyA, valueA)

        await map.set(keyA, valueB)

        await expectMembersMatch([keyA], [valueB])
      })
    })

    describe('remove', () => {
      it('removes added keys', async () => {
        await map.set(keyA, valueA)

        const tx = await map.remove(keyA)
        await assertEvent(tx, 'OperationResult', { result: true })

        expect(await map.contains(keyA)).to.equal(false)
        await expectMembersMatch([], [])
      })

      it('returns false when removing keys not in the set', async () => {
        const tx = await map.remove(keyA)
        await assertEvent(tx, 'OperationResult', { result: false })

        expect(await map.contains(keyA)).to.equal(false)
      })

      it('adds and removes multiple keys', async () => {
        await map.set(keyA, valueA)
        await map.set(keyC, valueC)
        await expectMembersMatch([keyA, keyC], [valueA, valueC]) // [A, C]

        await map.remove(keyA)
        await map.remove(keyB)
        await expectMembersMatch([keyC], [valueC]) // [C]

        await map.set(keyB, valueB)
        await expectMembersMatch([keyC, keyB], [valueC, valueB]) // [C, B]

        await map.set(keyA, valueA)
        await map.remove(keyC)
        await expectMembersMatch([keyA, keyB], [valueA, valueB]) // [A, B]

        await map.set(keyA, valueA)
        await map.set(keyB, valueB)
        await expectMembersMatch([keyA, keyB], [valueA, valueB]) // [A, B]

        await map.set(keyC, valueC)
        await map.remove(keyA)
        await expectMembersMatch([keyC, keyB], [valueC, valueB]) // [C, B]

        await map.set(keyA, valueA)
        await map.remove(keyB)
        await expectMembersMatch([keyC, keyA], [valueC, valueA]) // [C, A]

        expect(await map.contains(keyB)).to.equal(false)
      })
    })

    describe('read', () => {
      beforeEach(async () => {
        await map.set(keyA, valueA)
      })

      describe('get', () => {
        it('existing value', async () => {
          expect((await map.get(keyA)).toString()).to.be.equal(valueA.toString())
        })

        it('missing value', async () => {
          await expect(map.get(keyB)).to.be.revertedWith('EnumerableMap: nonexistent key')
        })
      })

      describe('tryGet', () => {
        it('existing value', async () => {
          const { exists, value } = await map.tryGet(keyA)
          expect(exists).to.be.equal(true)
          expect(value).to.be.equal(valueA)
        })

        it('missing value', async () => {
          const { exists, value } = await map.tryGet(keyB)
          expect(exists).to.be.equal(false)
          expect(value).to.be.equal(ZERO_ADDRESS)
        })
      })
    })
  })
})
