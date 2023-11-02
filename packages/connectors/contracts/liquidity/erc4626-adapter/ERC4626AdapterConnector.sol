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

import '@mimic-fi/v3-helpers/contracts/utils/ERC20Helpers.sol';

import './IERC4626Adapter.sol';
import '../../interfaces/liquidity/erc4626-adapter/IERC4626AdapterConnector.sol';

/**
 * @title ERC4626AdapterConnector
 */
contract ERC4626AdapterConnector is IERC4626AdapterConnector {
    // Reference to the ERC4626Adapter
    address public immutable override adapter;

    /**
     * @dev Creates a new ERC4626Adapter connector
     */
    constructor(address _adapter) {
        adapter = _adapter;
    }

    /**
     * @dev Deposits assets to the ERC4626 adapter
     * @param assets Amount of assets to be deposited
     */
    function join(uint256 assets) external override returns (address token, uint256 deposited) {
        token = getToken();
        if (assets == 0) return (token, 0);
        ERC20Helpers.approve(token, adapter, assets);
        uint256 shares = IERC4626Adapter(adapter).deposit(assets, address(this));
        deposited = IERC4626Adapter(adapter).convertToAssets(shares);
        if (deposited < assets) revert ERC4626AdapterInvalidDeposit(deposited, assets);
    }

    /**
     * @dev Withdtaws assets from the ERC4626 adapter
     * @param shares Amount of shares to be redeemed
     */
    function exit(uint256 shares) external override returns (address token, uint256 redeemed) {
        token = getToken();
        if (shares == 0) return (token, 0);
        uint256 assets = IERC4626Adapter(adapter).redeem(shares, address(this), address(this));
        redeemed = IERC4626Adapter(adapter).convertToShares(assets);
        if (redeemed < shares) revert ERC4626AdapterInvalidRedeem(redeemed, shares);
    }

    /**
     * @dev Tells the adapter's underlying token
     */
    function getToken() internal view returns (address) {
        return IERC4626Adapter(adapter).asset();
    }
}
