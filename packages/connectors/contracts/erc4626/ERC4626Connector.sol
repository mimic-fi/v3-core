// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.8.0;

import '@openzeppelin/contracts/interfaces/IERC4626.sol';

import '@mimic-fi/helpers/contracts/utils/ERC20Helpers.sol';

import '../interfaces/erc4626/IERC4626Connector.sol';

/**
 * @title ERC4626Connector
 */
contract ERC4626Connector is IERC4626Connector {
    /**
     * @dev Tells the underlying token of an ERC4626
     */
    function getToken(address erc4626) public view returns (address) {
        return IERC4626(erc4626).asset();
    }

    /**
     * @dev Deposits assets to an ERC4626
     * @param erc4626 Address of the ERC4626 to join
     * @param tokenIn Address of the token to join the ERC4626
     * @param assets Amount of assets to be deposited
     * @param minSharesOut Minimum amount of shares willing to receive
     */
    function join(address erc4626, address tokenIn, uint256 assets, uint256 minSharesOut)
        external
        override
        returns (address tokenOut, uint256 shares)
    {
        tokenOut = erc4626;
        if (assets == 0) return (tokenOut, 0);
        address expectedTokenIn = getToken(erc4626);
        if (tokenIn != expectedTokenIn) revert ERC4626InvalidToken(tokenIn, expectedTokenIn);

        uint256 preBalanceIn = IERC20(tokenIn).balanceOf(address(this));
        uint256 preBalanceOut = IERC20(tokenOut).balanceOf(address(this));

        ERC20Helpers.approve(tokenIn, erc4626, assets);
        IERC4626(erc4626).deposit(assets, address(this));

        uint256 postBalanceIn = IERC20(tokenIn).balanceOf(address(this));
        bool isPostBalanceInUnexpected = postBalanceIn < preBalanceIn - assets;
        if (isPostBalanceInUnexpected) revert ERC4626BadPostTokenInBalance(postBalanceIn, preBalanceIn, assets);

        uint256 postBalanceOut = IERC20(tokenOut).balanceOf(address(this));
        shares = postBalanceOut - preBalanceOut;
        if (shares < minSharesOut) revert ERC4626BadSharesOut(shares, minSharesOut);
    }

    /**
     * @dev Withdraws assets from an ERC4626
     * @param erc4626 Address of the ERC4626 to exit
     * @param shares Amount of shares to be redeemed
     * @param minAssetsOut Minimum amount of assets willing to receive
     */
    function exit(address erc4626, uint256 shares, uint256 minAssetsOut)
        external
        override
        returns (address token, uint256 assets)
    {
        token = getToken(erc4626);
        if (shares == 0) return (token, 0);

        uint256 preBalanceIn = IERC20(erc4626).balanceOf(address(this));
        uint256 preBalanceOut = IERC20(token).balanceOf(address(this));

        IERC4626(erc4626).redeem(shares, address(this), address(this));

        uint256 postBalanceIn = IERC20(erc4626).balanceOf(address(this));
        bool isPostBalanceInUnexpected = postBalanceIn < preBalanceIn - shares;
        if (isPostBalanceInUnexpected) revert ERC4626BadPostTokenInBalance(postBalanceIn, preBalanceIn, shares);

        uint256 postBalanceOut = IERC20(token).balanceOf(address(this));
        assets = postBalanceOut - preBalanceOut;
        if (assets < minAssetsOut) revert ERC4626BadAssetsOut(assets, minAssetsOut);
    }
}
