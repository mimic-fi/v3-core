import { assertEvent, deploy, getCreationCode, getSigners } from '@mimic-fi/helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

describe('Registry', () => {
  let registry: Contract, owner: SignerWithAddress, other: SignerWithAddress

  // eslint-disable-next-line no-secrets/no-secrets
  const implementation = '0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5'

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other] = await getSigners()
  })

  beforeEach('create registry', async () => {
    registry = await deploy('Registry', [owner.address])
  })

  describe('initialization', () => {
    it('sets the owner correctly', async () => {
      expect(await registry.owner()).to.be.equal(owner.address)
    })

    it('starts with all implementations unregistered and not-deprecated', async () => {
      expect(await registry.isRegistered(implementation)).to.be.false
      expect(await registry.isDeprecated(implementation)).to.be.false
    })
  })

  describe('create', () => {
    let bytecode: string
    const name = 'implementation@0.0.1'

    beforeEach('set bytecode', async () => {
      bytecode = await getCreationCode('Registry', [owner.address])
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', () => {
        registry = registry.connect(owner)
      })

      context('when the requested implementation was not created', () => {
        context('when the requested implementation is not registered', () => {
          context('when the requested implementation is considered stateless', () => {
            const stateless = true

            it('creates and registers the requested implementation', async () => {
              const tx = await registry.create(name, bytecode, stateless)

              const event = await assertEvent(tx, 'Registered', { name, stateless })

              const implementation = event.args.implementation
              expect(await registry.isRegistered(implementation)).to.be.true
              expect(await registry.isStateless(implementation)).to.be.true
              expect(await registry.isDeprecated(implementation)).to.be.false
            })
          })

          context('when the requested implementation is not considered stateless', () => {
            const stateless = false

            it('creates and registers the requested implementation', async () => {
              const tx = await registry.create(name, bytecode, stateless)

              const event = await assertEvent(tx, 'Registered', { name, stateless })

              const implementation = event.args.implementation
              expect(await registry.isRegistered(implementation)).to.be.true
              expect(await registry.isStateless(implementation)).to.be.false
              expect(await registry.isDeprecated(implementation)).to.be.false
            })
          })
        })

        context('when the requested implementation is registered', () => {
          beforeEach('register', async () => {
            await registry.register(name, implementation, true)
          })

          it('reverts', async () => {
            await expect(registry.register(name, implementation, true)).to.be.revertedWith(
              'RegistryImplementationRegistered'
            )
          })
        })
      })

      context('when the requested implementation was created', () => {
        beforeEach('create', async () => {
          await registry.create(name, bytecode, true)
        })

        it('reverts', async () => {
          await expect(registry.create(name, bytecode, true)).to.be.revertedWith('DEPLOYMENT_FAILED')
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        registry = registry.connect(other)
      })

      it('reverts', async () => {
        await expect(registry.create(name, implementation, true)).to.be.revertedWith('Ownable: caller is not the owner')
      })
    })
  })

  describe('register', () => {
    const name = 'implementation@0.0.1'

    context('when the sender is authorized', () => {
      beforeEach('set sender', () => {
        registry = registry.connect(owner)
      })

      context('when the requested implementation is not registered', () => {
        context('when the requested implementation is considered stateless', () => {
          const stateless = true

          it('registers the requested implementation', async () => {
            const tx = await registry.register(name, implementation, stateless)

            await assertEvent(tx, 'Registered', { name, implementation, stateless })

            expect(await registry.isRegistered(implementation)).to.be.true
            expect(await registry.isStateless(implementation)).to.be.true
            expect(await registry.isDeprecated(implementation)).to.be.false
          })
        })

        context('when the requested implementation is not considered stateless', () => {
          const stateless = false

          it('registers the requested implementation', async () => {
            const tx = await registry.register(name, implementation, stateless)

            await assertEvent(tx, 'Registered', { name, implementation, stateless })

            expect(await registry.isRegistered(implementation)).to.be.true
            expect(await registry.isStateless(implementation)).to.be.false
            expect(await registry.isDeprecated(implementation)).to.be.false
          })
        })
      })

      context('when the requested implementation is registered', () => {
        beforeEach('register', async () => {
          await registry.register(name, implementation, true)
        })

        it('reverts', async () => {
          await expect(registry.register(name, implementation, true)).to.be.revertedWith(
            'RegistryImplementationRegistered'
          )
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        registry = registry.connect(other)
      })

      it('reverts', async () => {
        await expect(registry.register(name, implementation, true)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        )
      })
    })
  })

  describe('deprecate', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', () => {
        registry = registry.connect(owner)
      })

      context('when the requested implementation is not registered', () => {
        it('reverts', async () => {
          await expect(registry.deprecate(implementation)).to.be.revertedWith('RegistryImplementationNotRegistered')
        })
      })

      context('when the requested implementation is registered', () => {
        beforeEach('register', async () => {
          await registry.register('implementation@0.0.1', implementation, true)
        })

        context('when the requested implementation is not deprecated', () => {
          it('registers the requested implementation', async () => {
            await registry.deprecate(implementation)

            expect(await registry.isRegistered(implementation)).to.be.true
            expect(await registry.isStateless(implementation)).to.be.true
            expect(await registry.isDeprecated(implementation)).to.be.true
          })

          it('emits an event', async () => {
            const tx = await registry.deprecate(implementation)

            await assertEvent(tx, 'Deprecated', { implementation })
          })
        })

        context('when the requested implementation is deprecated', () => {
          beforeEach('deprecate', async () => {
            await registry.deprecate(implementation)
          })

          it('reverts', async () => {
            await expect(registry.deprecate(implementation)).to.be.revertedWith('RegistryImplementationDeprecated')
          })
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        registry = registry.connect(other)
      })

      it('reverts', async () => {
        await expect(registry.deprecate(implementation)).to.be.revertedWith('Ownable: caller is not the owner')
      })
    })
  })
})
