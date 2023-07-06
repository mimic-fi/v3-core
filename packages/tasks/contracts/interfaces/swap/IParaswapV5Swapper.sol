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

pragma solidity >=0.8.0;

import './IBaseSwapTask.sol';

/**
 * @dev Paraswap v5 swapper task interface
 */
interface IParaswapV5Swapper is IBaseSwapTask {
    /**
     * @dev Emitted every time a quote signer is set
     */
    event QuoteSignerSet(address indexed quoteSigner);

    /**
     * @dev Tells the address of the allowed quote signer
     */
    function quoteSigner() external view returns (address);

    /**
     * @dev Sets the quote signer address. Sender must be authorized.
     * @param newQuoteSigner Address of the new quote signer to be set
     */
    function setQuoteSigner(address newQuoteSigner) external;

    /**
     * @dev Executes Paraswap V5 swapper task
     */
    function call(
        address tokenIn,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 expectedAmountOut,
        uint256 deadline,
        bytes memory data,
        bytes memory sig
    ) external;
}
