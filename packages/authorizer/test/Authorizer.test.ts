import { assertEvent, deployProxy, getSigner, getSigners, ONES_ADDRESS, ZERO_ADDRESS } from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { OP } from '../src/constants'

/* eslint-disable no-secrets/no-secrets */

describe('Authorizer', () => {
  let authorizer: Contract, admin: SignerWithAddress, anotherAdmin: SignerWithAddress

  const ANYONE = ONES_ADDRESS
  const ANYWHERE = ONES_ADDRESS
  const WHO = '0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5'
  const WHO2 = '0x59694d70f02e9a54db82dc2990e343c9c86adc73'
  const WHERE = '0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552'
  const WHERE2 = '0xa51807d9f4e57a26a1659c83e44a8c4e23623037'
  const WHAT = '0x5229073f'
  const WHAT2 = '0x8c8503c5'

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, admin, anotherAdmin] = await getSigners()
  })

  beforeEach('create authorizer', async () => {
    authorizer = await deployProxy('Authorizer', [], [[admin.address, anotherAdmin.address]])
  })

  describe('initialization', () => {
    it('cannot be initialized twice', async () => {
      await expect(authorizer.initialize([])).to.be.revertedWith('Initializable: contract is already initialized')
    })

    it('allows admins to generally authorize and unauthorize permissions', async () => {
      const authorizeRole = authorizer.interface.getSighash('authorize')
      const unauthorizeRole = authorizer.interface.getSighash('unauthorize')

      expect(await authorizer.hasPermissions(admin.address, authorizer.address)).to.be.true
      expect(await authorizer.getPermissionsLength(admin.address, authorizer.address)).to.be.equal(2)

      expect(await authorizer.isAuthorized(admin.address, authorizer.address, authorizeRole, [])).to.be.true
      expect(await authorizer.isAuthorized(admin.address, authorizer.address, unauthorizeRole, [])).to.be.true

      expect(await authorizer.hasPermissions(anotherAdmin.address, authorizer.address)).to.be.true
      expect(await authorizer.getPermissionsLength(anotherAdmin.address, authorizer.address)).to.be.equal(2)

      expect(await authorizer.isAuthorized(anotherAdmin.address, authorizer.address, authorizeRole, [])).to.be.true
      expect(await authorizer.isAuthorized(anotherAdmin.address, authorizer.address, unauthorizeRole, [])).to.be.true
    })

    it('does not allow admins on other permissions or other targets', async () => {
      expect(await authorizer.hasPermissions(WHO, WHERE)).to.be.false
      expect(await authorizer.getPermissionsLength(WHO, WHERE)).to.be.equal(0)

      expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [])).to.be.false
      expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [0, 1])).to.be.false

      expect(await authorizer.hasPermissions(ANYONE, WHERE)).to.be.false
      expect(await authorizer.getPermissionsLength(ANYONE, WHERE)).to.be.equal(0)

      expect(await authorizer.isAuthorized(ANYONE, WHERE, WHAT, [])).to.be.false
      expect(await authorizer.isAuthorized(ANYONE, WHERE, WHAT, [0, 1])).to.be.false

      expect(await authorizer.hasPermissions(WHO, ANYWHERE)).to.be.false
      expect(await authorizer.getPermissionsLength(WHO, ANYWHERE)).to.be.equal(0)

      expect(await authorizer.isAuthorized(WHO, ANYWHERE, WHAT, [])).to.be.false
      expect(await authorizer.isAuthorized(WHO, ANYWHERE, WHAT, [0, 1])).to.be.false
    })
  })

  describe('authorize', () => {
    context('when the sender is allowed', () => {
      beforeEach('set sender', async () => {
        authorizer = authorizer.connect(admin)
      })

      context('when the permission was not granted', () => {
        context('when setting no params', () => {
          const PARAMS = []

          it('grants the permission correctly', async () => {
            const tx = await authorizer.authorize(WHO, WHERE, WHAT, PARAMS)

            await assertEvent(tx, 'Authorized', { who: WHO, where: WHERE, what: WHAT, params: PARAMS })

            expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [])).to.be.true
            expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [])).to.be.true

            expect(await authorizer.isAuthorized(WHO, WHERE, WHAT2, [])).to.be.false
            expect(await authorizer.isAuthorized(WHO, WHERE2, WHAT, [])).to.be.false
            expect(await authorizer.isAuthorized(WHO2, WHERE, WHAT, [])).to.be.false
          })

          it('increments the number of permissions correctly', async () => {
            await authorizer.authorize(WHO, WHERE, WHAT, PARAMS)

            expect(await authorizer.hasPermissions(WHO, WHERE)).to.be.true
            expect(await authorizer.getPermissionsLength(WHO, WHERE)).to.be.equal(1)

            await authorizer.authorize(WHO, WHERE, WHAT, PARAMS)

            expect(await authorizer.hasPermissions(WHO, WHERE)).to.be.true
            expect(await authorizer.getPermissionsLength(WHO, WHERE)).to.be.equal(1)

            await authorizer.authorize(WHO, WHERE, WHAT2, PARAMS)

            expect(await authorizer.hasPermissions(WHO, WHERE)).to.be.true
            expect(await authorizer.getPermissionsLength(WHO, WHERE)).to.be.equal(2)

            await authorizer.authorize(WHO, WHERE2, WHAT2, PARAMS)

            expect(await authorizer.hasPermissions(WHO, WHERE)).to.be.true
            expect(await authorizer.getPermissionsLength(WHO, WHERE)).to.be.equal(2)

            await authorizer.authorize(WHO2, WHERE, WHAT2, PARAMS)

            expect(await authorizer.hasPermissions(WHO, WHERE)).to.be.true
            expect(await authorizer.getPermissionsLength(WHO, WHERE)).to.be.equal(2)
          })
        })

        context('when setting some params', () => {
          context('when providing one single param', () => {
            context('when requiring none', () => {
              const PARAMS = [{ op: OP.NONE, value: 5 }]

              it('sets the permission params correctly', async () => {
                await authorizer.authorize(WHO, WHERE, WHAT, PARAMS)

                const params = await authorizer.getPermissionParams(WHO, WHERE, WHAT)
                expect(params).to.have.lengthOf(1)
                expect(params[0].op).to.be.equal(OP.NONE)
                expect(params[0].value).to.be.equal(5)
              })

              it('is simply ignored', async () => {
                await authorizer.authorize(WHO, WHERE, WHAT, PARAMS)

                const params = await authorizer.getPermissionParams(WHO, WHERE, WHAT)
                expect(params).to.have.lengthOf(1)
                expect(params[0].op).to.be.equal(OP.NONE)
                expect(params[0].value).to.be.equal(5)

                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [])).to.be.true
                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [10])).to.be.true
                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [10, 12, 24])).to.be.true
                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [ZERO_ADDRESS])).to.be.true

                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT2, [])).to.be.false
                expect(await authorizer.isAuthorized(WHO, WHERE2, WHAT, [])).to.be.false
                expect(await authorizer.isAuthorized(WHO2, WHERE, WHAT, [])).to.be.false
              })
            })

            context('when requiring equal', () => {
              const PARAMS = [{ op: OP.EQ, value: 10 }]

              it('sets the permission params correctly', async () => {
                await authorizer.authorize(WHO, WHERE, WHAT, PARAMS)

                const params = await authorizer.getPermissionParams(WHO, WHERE, WHAT)
                expect(params).to.have.lengthOf(1)
                expect(params[0].op).to.be.equal(OP.EQ)
                expect(params[0].value).to.be.equal(10)
              })

              it('is requires the first param to be equal', async () => {
                await authorizer.authorize(WHO, WHERE, WHAT, PARAMS)

                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [10])).to.be.true

                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [])).to.be.false
                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [12, 10, 24])).to.be.false
                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [ZERO_ADDRESS, 0])).to.be.false

                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT2, [10])).to.be.false
                expect(await authorizer.isAuthorized(WHO, WHERE2, WHAT, [10])).to.be.false
                expect(await authorizer.isAuthorized(WHO2, WHERE, WHAT, [10])).to.be.false
              })
            })

            context('when requiring not equal', () => {
              const PARAMS = [{ op: OP.NEQ, value: 10 }]

              it('sets the permission params correctly', async () => {
                await authorizer.authorize(WHO, WHERE, WHAT, PARAMS)

                const params = await authorizer.getPermissionParams(WHO, WHERE, WHAT)
                expect(params).to.have.lengthOf(1)
                expect(params[0].op).to.be.equal(OP.NEQ)
                expect(params[0].value).to.be.equal(10)
              })

              it('is requires the first param to not be equal', async () => {
                await authorizer.authorize(WHO, WHERE, WHAT, PARAMS)

                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [11])).to.be.true
                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [12])).to.be.true
                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [12, 10, 24])).to.be.true
                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [ZERO_ADDRESS, 0])).to.be.true

                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [])).to.be.false
                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [10])).to.be.false

                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT2, [11])).to.be.false
                expect(await authorizer.isAuthorized(WHO, WHERE2, WHAT, [11])).to.be.false
                expect(await authorizer.isAuthorized(WHO2, WHERE, WHAT, [11])).to.be.false
              })
            })

            context('when requiring greater than', () => {
              const PARAMS = [{ op: OP.GT, value: 10 }]

              it('sets the permission params correctly', async () => {
                await authorizer.authorize(WHO, WHERE, WHAT, PARAMS)

                const params = await authorizer.getPermissionParams(WHO, WHERE, WHAT)
                expect(params).to.have.lengthOf(1)
                expect(params[0].op).to.be.equal(OP.GT)
                expect(params[0].value).to.be.equal(10)
              })

              it('is requires the first param to be greater than', async () => {
                await authorizer.authorize(WHO, WHERE, WHAT, PARAMS)

                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [11])).to.be.true
                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [12])).to.be.true
                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [12, 10, 24])).to.be.true
                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [12, ZERO_ADDRESS, 0])).to.be.true

                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [])).to.be.false
                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [10])).to.be.false
                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [10, ZERO_ADDRESS])).to.be.false

                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT2, [11])).to.be.false
                expect(await authorizer.isAuthorized(WHO, WHERE2, WHAT, [11])).to.be.false
                expect(await authorizer.isAuthorized(WHO2, WHERE, WHAT, [11])).to.be.false
              })
            })

            context('when requiring greater than or equal', () => {
              const PARAMS = [{ op: OP.GTE, value: 10 }]

              it('sets the permission params correctly', async () => {
                await authorizer.authorize(WHO, WHERE, WHAT, PARAMS)

                const params = await authorizer.getPermissionParams(WHO, WHERE, WHAT)
                expect(params).to.have.lengthOf(1)
                expect(params[0].op).to.be.equal(OP.GTE)
                expect(params[0].value).to.be.equal(10)
              })

              it('is requires the first param to be greater than or equal', async () => {
                await authorizer.authorize(WHO, WHERE, WHAT, PARAMS)

                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [10])).to.be.true
                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [12])).to.be.true
                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [10, 10, 24])).to.be.true
                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [12, ZERO_ADDRESS, 0])).to.be.true

                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [])).to.be.false
                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [9])).to.be.false
                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [9, ZERO_ADDRESS])).to.be.false

                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT2, [11])).to.be.false
                expect(await authorizer.isAuthorized(WHO, WHERE2, WHAT, [11])).to.be.false
                expect(await authorizer.isAuthorized(WHO2, WHERE, WHAT, [11])).to.be.false
              })
            })

            context('when requiring lower than', () => {
              const PARAMS = [{ op: OP.LT, value: 10 }]

              it('sets the permission params correctly', async () => {
                await authorizer.authorize(WHO, WHERE, WHAT, PARAMS)

                const params = await authorizer.getPermissionParams(WHO, WHERE, WHAT)
                expect(params).to.have.lengthOf(1)
                expect(params[0].op).to.be.equal(OP.LT)
                expect(params[0].value).to.be.equal(10)
              })

              it('is requires the first param to be lower than', async () => {
                await authorizer.authorize(WHO, WHERE, WHAT, PARAMS)

                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [7])).to.be.true
                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [9])).to.be.true
                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [9, 10, 24])).to.be.true
                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [9, ZERO_ADDRESS, 0])).to.be.true

                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [])).to.be.false
                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [10])).to.be.false
                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [10, ZERO_ADDRESS])).to.be.false

                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT2, [9])).to.be.false
                expect(await authorizer.isAuthorized(WHO, WHERE2, WHAT, [9])).to.be.false
                expect(await authorizer.isAuthorized(WHO2, WHERE, WHAT, [9])).to.be.false
              })
            })

            context('when requiring lower than or equal', () => {
              const PARAMS = [{ op: OP.LTE, value: 10 }]

              it('sets the permission params correctly', async () => {
                await authorizer.authorize(WHO, WHERE, WHAT, PARAMS)

                const params = await authorizer.getPermissionParams(WHO, WHERE, WHAT)
                expect(params).to.have.lengthOf(1)
                expect(params[0].op).to.be.equal(OP.LTE)
                expect(params[0].value).to.be.equal(10)
              })

              it('is requires the first param to be lower than or equal', async () => {
                await authorizer.authorize(WHO, WHERE, WHAT, PARAMS)

                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [9])).to.be.true
                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [10])).to.be.true
                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [9, 10, 24])).to.be.true
                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [10, ZERO_ADDRESS, 0])).to.be.true

                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [])).to.be.false
                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [11])).to.be.false
                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [11, ZERO_ADDRESS])).to.be.false

                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT2, [9])).to.be.false
                expect(await authorizer.isAuthorized(WHO, WHERE2, WHAT, [9])).to.be.false
                expect(await authorizer.isAuthorized(WHO2, WHERE, WHAT, [9])).to.be.false
              })
            })
          })

          context('when providing multiple params', () => {
            context('when controlling foreign contracts', () => {
              const PARAMS = [
                { op: OP.NONE, value: 0 },
                { op: OP.GTE, value: ONES_ADDRESS },
                { op: OP.EQ, value: ONES_ADDRESS },
                { op: OP.LT, value: 10 },
              ]

              it('sets the permission params correctly', async () => {
                await authorizer.authorize(WHO, WHERE, WHAT, PARAMS)

                const params = await authorizer.getPermissionParams(WHO, WHERE, WHAT)
                expect(params).to.have.lengthOf(4)
                expect(params[0].op).to.be.equal(OP.NONE)
                expect(params[0].value).to.be.equal(0)
                expect(params[1].op).to.be.equal(OP.GTE)
                expect(params[1].value).to.be.equal(ONES_ADDRESS)
                expect(params[2].op).to.be.equal(OP.EQ)
                expect(params[2].value).to.be.equal(ONES_ADDRESS)
                expect(params[3].op).to.be.equal(OP.LT)
                expect(params[3].value).to.be.equal(10)
              })

              it('validates all the requested params correctly', async () => {
                await authorizer.authorize(WHO, WHERE, WHAT, PARAMS)

                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [0, ONES_ADDRESS, ONES_ADDRESS, 9])).to.be.true
                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [1, ONES_ADDRESS, ONES_ADDRESS, 8])).to.be.true

                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [1, ZERO_ADDRESS, ONES_ADDRESS, 8])).to.be.false
                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [1, ONES_ADDRESS, ZERO_ADDRESS, 8])).to.be.false
              })
            })

            context('when controlling the authorizer itself', () => {
              const PARAMS = [
                { op: OP.NONE, value: 0 },
                { op: OP.EQ, value: WHERE },
                { op: OP.NEQ, value: WHAT2 },
              ]

              it('is works as expected', async () => {
                const who = await getSigner()
                const authorizeRole = authorizer.interface.getSighash('authorize')
                await authorizer.authorize(who.address, authorizer.address, authorizeRole, PARAMS)

                // try granting allowed permission
                await authorizer.connect(who).authorize(WHO, WHERE, WHAT, [])
                expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [])).to.be.true

                // try granting other permissions
                await expect(authorizer.connect(who).authorize(WHO, WHERE2, WHAT, [])).to.be.revertedWith(
                  'AuthorizerSenderNotAllowed'
                )
                await expect(authorizer.connect(who).authorize(WHO, WHERE, WHAT2, [])).to.be.revertedWith(
                  'AuthorizerSenderNotAllowed'
                )

                // rollback authorization
                await authorizer.unauthorize(who.address, authorizer.address, authorizeRole)
                expect(await authorizer.isAuthorized(who.address, authorizer.address, authorizeRole, [])).to.be.false
                await expect(authorizer.connect(who).authorize(WHO, WHERE, WHAT, [])).to.be.revertedWith(
                  'AuthorizerSenderNotAllowed'
                )
              })
            })
          })
        })
      })

      context('when the permission was already granted', () => {
        before('set permission', async () => {
          await authorizer.authorize(WHO, WHERE, WHAT, [
            { op: OP.NEQ, value: 11 },
            { op: OP.EQ, value: 1 },
          ])
        })

        it('overwrites the previous permission params correctly', async () => {
          await authorizer.authorize(WHO, WHERE, WHAT, [{ op: OP.GT, value: 10 }])

          const params = await authorizer.getPermissionParams(WHO, WHERE, WHAT)
          expect(params).to.have.lengthOf(1)
          expect(params[0].op).to.be.equal(OP.GT)
          expect(params[0].value).to.be.equal(10)

          expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [11])).to.be.true
          expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [12])).to.be.true
          expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [12, 10, 24])).to.be.true
          expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [12, ZERO_ADDRESS, 0])).to.be.true

          expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [])).to.be.false
          expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [10])).to.be.false
          expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [10, ZERO_ADDRESS])).to.be.false

          expect(await authorizer.isAuthorized(WHO, WHERE, WHAT2, [11])).to.be.false
          expect(await authorizer.isAuthorized(WHO, WHERE2, WHAT, [11])).to.be.false
          expect(await authorizer.isAuthorized(WHO2, WHERE, WHAT, [11])).to.be.false
        })
      })
    })

    context('when the sender is not allowed', () => {
      it('reverts', async () => {
        await expect(authorizer.authorize(WHO, WHERE, WHAT, [])).to.be.revertedWith('AuthorizerSenderNotAllowed')
      })
    })
  })

  describe('unauthorize', () => {
    context('when the sender is allowed', () => {
      beforeEach('set sender', async () => {
        authorizer = authorizer.connect(admin)
      })

      context('when the permission was set', () => {
        beforeEach('set permission', async () => {
          await authorizer.authorize(WHO, WHERE, WHAT, [
            { op: OP.NEQ, value: 11 },
            { op: OP.EQ, value: 1 },
          ])
        })

        it('revokes the permission correctly', async () => {
          const tx = await authorizer.unauthorize(WHO, WHERE, WHAT)

          await assertEvent(tx, 'Unauthorized', { who: WHO, where: WHERE, what: WHAT })

          expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [])).to.be.false
          expect(await authorizer.getPermissionParams(WHO, WHERE, WHAT)).to.have.lengthOf(0)
        })

        it('decrements the number of permissions correctly', async () => {
          await authorizer.unauthorize(WHO, WHERE, WHAT)

          expect(await authorizer.hasPermissions(WHO, WHERE)).to.be.false
          expect(await authorizer.getPermissionsLength(WHO, WHERE)).to.be.equal(0)

          await authorizer.authorize(WHO, WHERE, WHAT, [])
          await authorizer.authorize(WHO, WHERE, WHAT2, [])

          expect(await authorizer.hasPermissions(WHO, WHERE)).to.be.true
          expect(await authorizer.getPermissionsLength(WHO, WHERE)).to.be.equal(2)

          await authorizer.unauthorize(WHO, WHERE, WHAT)
          await authorizer.unauthorize(WHO, WHERE, WHAT)

          expect(await authorizer.hasPermissions(WHO, WHERE)).to.be.true
          expect(await authorizer.getPermissionsLength(WHO, WHERE)).to.be.equal(1)

          await authorizer.unauthorize(WHO, WHERE, WHAT2)

          expect(await authorizer.hasPermissions(WHO, WHERE)).to.be.false
          expect(await authorizer.getPermissionsLength(WHO, WHERE)).to.be.equal(0)
        })
      })

      context('when the permission was not granted', () => {
        it('ignores the request', async () => {
          const tx = await authorizer.unauthorize(WHO, WHERE, WHAT)

          await assertEvent(tx, 'Unauthorized', { who: WHO, where: WHERE, what: WHAT })
          expect(await authorizer.isAuthorized(WHO, WHERE, WHAT, [])).to.be.false
        })
      })
    })

    context('when the sender is not allowed', () => {
      it('reverts', async () => {
        await expect(authorizer.unauthorize(WHO, WHERE, WHAT)).to.be.revertedWith('AuthorizerSenderNotAllowed')
      })
    })
  })

  describe('changePermissions', () => {
    context('when the sender is allowed', () => {
      it('applies the permission changes correctly', async () => {
        const authorizeRole = authorizer.interface.getSighash('authorize')
        const unauthorizeRole = authorizer.interface.getSighash('unauthorize')

        await authorizer.connect(admin).changePermissions([
          { where: WHERE2, grants: [{ who: WHO2, what: WHAT2, params: [] }], revokes: [] },
          {
            where: authorizer.address,
            grants: [
              { who: WHO, what: authorizeRole, params: [{ op: OP.EQ, value: WHO }] },
              { who: WHO2, what: authorizeRole, params: [] },
              {
                who: WHO2,
                what: unauthorizeRole,
                params: [
                  { op: OP.NONE, value: 0 },
                  { op: OP.NEQ, value: WHERE },
                ],
              },
            ],
            revokes: [
              { who: admin.address, what: authorizeRole },
              { who: anotherAdmin.address, what: unauthorizeRole },
            ],
          },
        ])

        expect(await authorizer.isAuthorized(WHO2, WHERE2, WHAT2, [])).to.be.true

        expect(await authorizer.isAuthorized(WHO, authorizer.address, authorizeRole, [WHO])).to.be.true
        expect(await authorizer.isAuthorized(WHO, authorizer.address, authorizeRole, [WHO2])).to.be.false

        expect(await authorizer.isAuthorized(WHO2, authorizer.address, authorizeRole, [WHO])).to.be.true
        expect(await authorizer.isAuthorized(WHO2, authorizer.address, unauthorizeRole, [0, WHERE2, 0])).to.be.true

        expect(await authorizer.isAuthorized(admin.address, authorizer.address, authorizeRole, [])).to.be.false
        expect(await authorizer.isAuthorized(anotherAdmin.address, authorizer.address, unauthorizeRole, [])).to.be.false
      })
    })

    context('when the sender is partially allowed', () => {
      beforeEach('unauthorize admin to authorize', async () => {
        const authorizeRole = authorizer.interface.getSighash('authorize')
        await authorizer.connect(admin).unauthorize(admin.address, authorizer.address, authorizeRole)
      })

      it('reverts', async () => {
        await expect(
          authorizer
            .connect(admin)
            .changePermissions([{ where: WHERE2, grants: [{ who: WHO2, what: WHAT2, params: [] }], revokes: [] }])
        ).to.be.revertedWith('AuthorizerSenderNotAllowed')
      })
    })
  })

  describe('anyone', () => {
    const someone = WHO

    context('when it is not allowed', () => {
      beforeEach('unauthorize anyone', async () => {
        await authorizer.connect(admin).unauthorize(ANYONE, WHERE, WHAT)
      })

      context('when someone is not authorized', () => {
        it('is not authorized', async () => {
          expect(await authorizer.isAuthorized(someone, WHERE, WHAT, [])).to.be.false
        })

        it('someone does not have permissions', async () => {
          expect(await authorizer.hasPermissions(someone, WHERE)).to.be.false
          expect(await authorizer.getPermissionsLength(someone, WHERE)).to.be.equal(0)
        })

        it('anyone does not have permission', async () => {
          expect(await authorizer.hasPermissions(ANYONE, WHERE)).to.be.false
          expect(await authorizer.getPermissionsLength(ANYONE, WHERE)).to.be.equal(0)
        })
      })

      context('when someone is authorized', () => {
        beforeEach('authorize someone', async () => {
          await authorizer.connect(admin).authorize(someone, WHERE, WHAT, [])
        })

        it('is authorized', async () => {
          expect(await authorizer.isAuthorized(someone, WHERE, WHAT, [])).to.be.true
        })

        it('someone has permissions', async () => {
          expect(await authorizer.hasPermissions(someone, WHERE)).to.be.true
          expect(await authorizer.getPermissionsLength(someone, WHERE)).to.be.equal(1)
        })

        it('anyone does not have permission', async () => {
          expect(await authorizer.hasPermissions(ANYONE, WHERE)).to.be.false
          expect(await authorizer.getPermissionsLength(ANYONE, WHERE)).to.be.equal(0)
        })
      })
    })

    context('when it is allowed', () => {
      beforeEach('authorize anyone', async () => {
        await authorizer.connect(admin).authorize(ANYONE, WHERE, WHAT, [{ op: OP.EQ, value: 10 }])
      })

      context('when someone is not authorized', () => {
        it('is authorized anyway', async () => {
          expect(await authorizer.isAuthorized(someone, WHERE, WHAT, [])).to.be.false
          expect(await authorizer.isAuthorized(someone, WHERE, WHAT, [10])).to.be.true
        })

        it('someone does not have permissions', async () => {
          expect(await authorizer.hasPermissions(someone, WHERE)).to.be.false
          expect(await authorizer.getPermissionsLength(someone, WHERE)).to.be.equal(0)
        })

        it('anyone has permissions', async () => {
          expect(await authorizer.hasPermissions(ANYONE, WHERE)).to.be.true
          expect(await authorizer.getPermissionsLength(ANYONE, WHERE)).to.be.equal(1)
        })
      })

      context('when someone is authorized', () => {
        beforeEach('authorize someone', async () => {
          await authorizer.connect(admin).authorize(someone, WHERE, WHAT, [])
        })

        it('is authorized anyway', async () => {
          expect(await authorizer.isAuthorized(someone, WHERE, WHAT, [])).to.be.true
          expect(await authorizer.isAuthorized(someone, WHERE, WHAT, [10])).to.be.true
        })

        it('someone has permissions', async () => {
          expect(await authorizer.hasPermissions(someone, WHERE)).to.be.true
          expect(await authorizer.getPermissionsLength(someone, WHERE)).to.be.equal(1)
        })

        it('anyone has permissions', async () => {
          expect(await authorizer.hasPermissions(ANYONE, WHERE)).to.be.true
          expect(await authorizer.getPermissionsLength(ANYONE, WHERE)).to.be.equal(1)
        })
      })
    })
  })

  describe('anywhere', () => {
    const somewhere = WHERE

    context('when it is not authorized', () => {
      beforeEach('unauthorize anywhere', async () => {
        await authorizer.connect(admin).unauthorize(WHO, ANYWHERE, WHAT)
      })

      context('when somewhere is not authorized', () => {
        it('is not authorized', async () => {
          expect(await authorizer.isAuthorized(WHO, somewhere, WHAT, [])).to.be.false
        })

        it('does not have permissions over somewhere', async () => {
          expect(await authorizer.hasPermissions(WHO, somewhere)).to.be.false
          expect(await authorizer.getPermissionsLength(WHO, somewhere)).to.be.equal(0)
        })

        it('does not have permissions over anywhere', async () => {
          expect(await authorizer.hasPermissions(WHO, ANYWHERE)).to.be.false
          expect(await authorizer.getPermissionsLength(WHO, ANYWHERE)).to.be.equal(0)
        })
      })

      context('when somewhere is authorized', () => {
        beforeEach('authorize somewhere', async () => {
          await authorizer.connect(admin).authorize(WHO, somewhere, WHAT, [])
        })

        it('is authorized', async () => {
          expect(await authorizer.isAuthorized(WHO, somewhere, WHAT, [])).to.be.true
        })

        it('has permissions over somewhere', async () => {
          expect(await authorizer.hasPermissions(WHO, somewhere)).to.be.true
          expect(await authorizer.getPermissionsLength(WHO, somewhere)).to.be.equal(1)
        })

        it('does not have permissions over anywhere', async () => {
          expect(await authorizer.hasPermissions(WHO, ANYWHERE)).to.be.false
          expect(await authorizer.getPermissionsLength(WHO, ANYWHERE)).to.be.equal(0)
        })
      })
    })

    context('when it is authorized', () => {
      beforeEach('authorize anyone', async () => {
        await authorizer.connect(admin).authorize(WHO, ANYWHERE, WHAT, [{ op: OP.EQ, value: 10 }])
      })

      context('when somewhere is not authorized', () => {
        it('is authorized anyway', async () => {
          expect(await authorizer.isAuthorized(WHO, somewhere, WHAT, [])).to.be.false
          expect(await authorizer.isAuthorized(WHO, somewhere, WHAT, [10])).to.be.true
        })

        it('does not have permissions over somewhere', async () => {
          expect(await authorizer.hasPermissions(WHO, somewhere)).to.be.false
          expect(await authorizer.getPermissionsLength(WHO, somewhere)).to.be.equal(0)
        })

        it('has permissions over anywhere', async () => {
          expect(await authorizer.hasPermissions(WHO, ANYWHERE)).to.be.true
          expect(await authorizer.getPermissionsLength(WHO, ANYWHERE)).to.be.equal(1)
        })
      })

      context('when somewhere is authorized', () => {
        beforeEach('authorize somewhere', async () => {
          await authorizer.connect(admin).authorize(WHO, somewhere, WHAT, [])
        })

        it('is authorized anyway', async () => {
          expect(await authorizer.isAuthorized(WHO, somewhere, WHAT, [])).to.be.true
          expect(await authorizer.isAuthorized(WHO, somewhere, WHAT, [10])).to.be.true
        })

        it('has permissions over somewhere', async () => {
          expect(await authorizer.hasPermissions(WHO, somewhere)).to.be.true
          expect(await authorizer.getPermissionsLength(WHO, somewhere)).to.be.equal(1)
        })

        it('has permissions over anywhere', async () => {
          expect(await authorizer.hasPermissions(WHO, ANYWHERE)).to.be.true
          expect(await authorizer.getPermissionsLength(WHO, ANYWHERE)).to.be.equal(1)
        })
      })
    })
  })
})
