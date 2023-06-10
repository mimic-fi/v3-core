// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../interfaces/IPriceFeedProvider.sol';

contract PriceFeedProviderMock is IPriceFeedProvider {
    mapping (address => mapping (address => address)) public override getPriceFeed;

    function setPriceFeed(address base, address quote, address feed) public {
        getPriceFeed[base][quote] = feed;
    }

    function setPriceFeeds(address[] memory bases, address[] memory quotes, address[] memory feeds) public {
        require(bases.length == quotes.length, 'SET_FEEDS_INVALID_QUOTES_LENGTH');
        require(bases.length == feeds.length, 'SET_FEEDS_INVALID_FEEDS_LENGTH');
        for (uint256 i = 0; i < bases.length; i++) setPriceFeed(bases[i], quotes[i], feeds[i]);
    }
}
