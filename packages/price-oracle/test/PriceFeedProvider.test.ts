import { assertEvent, deploy, ZERO_ADDRESS } from '@mimic-fi/v3-helpers'
import { expect } from 'chai'
import { Contract } from 'ethers'

describe('PriceFeedProvider', () => {
  let provider: Contract, base: Contract, quote: Contract, feed: Contract

  beforeEach('create provider', async () => {
    provider = await deploy('PriceFeedProvider')
  })

  describe('setPriceFeeds', () => {
    beforeEach('deploy feed and tokens', async () => {
      feed = await deploy('FeedMock', [0, 0])
      base = await deploy('TokenMock', ['BASE', 18])
      quote = await deploy('TokenMock', ['QUOTE', 18])
    })

    context('when the input length is valid', () => {
      const itCanBeSet = () => {
        it('can be set', async () => {
          const tx = await provider.setPriceFeeds([base.address], [quote.address], [feed.address])

          expect(await provider.getPriceFeed(base.address, quote.address)).to.be.equal(feed.address)

          await assertEvent(tx, 'PriceFeedSet', { base, quote, feed })
        })
      }

      const itCanBeUnset = () => {
        it('can be unset', async () => {
          const tx = await provider.setPriceFeeds([base.address], [quote.address], [ZERO_ADDRESS])

          expect(await provider.getPriceFeed(base.address, quote.address)).to.be.equal(ZERO_ADDRESS)

          await assertEvent(tx, 'PriceFeedSet', { base, quote, feed: ZERO_ADDRESS })
        })
      }

      context('when the feed is set', () => {
        beforeEach('set feed', async () => {
          await provider.setPriceFeeds([base.address], [quote.address], [feed.address])
          expect(await provider.getPriceFeed(base.address, quote.address)).to.be.equal(feed.address)
        })

        itCanBeSet()
        itCanBeUnset()
      })

      context('when the feed is not set', () => {
        beforeEach('unset feed', async () => {
          await provider.setPriceFeeds([base.address], [quote.address], [ZERO_ADDRESS])
          expect(await provider.getPriceFeed(base.address, quote.address)).to.be.equal(ZERO_ADDRESS)
        })

        itCanBeSet()
        itCanBeUnset()
      })
    })

    context('when the input is invalid', () => {
      it('reverts', async () => {
        await expect(
          provider.setPriceFeeds([base.address], [quote.address, ZERO_ADDRESS], [ZERO_ADDRESS])
        ).to.be.revertedWith('SET_FEEDS_INVALID_QUOTES_LENGTH')
        await expect(
          provider.setPriceFeeds([base.address], [quote.address], [ZERO_ADDRESS, ZERO_ADDRESS])
        ).to.be.revertedWith('SET_FEEDS_INVALID_FEEDS_LENGTH')
      })
    })
  })
})
