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

import '@mimic-fi/v3-connectors/contracts/interfaces/liquidity/morpho/IMorphoAaveV3Connector.sol';
import '@mimic-fi/v3-helpers/contracts/utils/BytesHelpers.sol';

import './BaseMorphoAaveV3Task.sol';
import '../../interfaces/liquidity/morpho/IMorphoAaveV3Claimer.sol';

/**
 * @title Morpho-Aave V3 claimer
 * @dev Task that extends the base Morpho-Aave V3 task to claim Morpho-Aave V3 pools
 */
contract MorphoAaveV3Claimer is IMorphoAaveV3Claimer, BaseMorphoAaveV3Task {
    using BytesHelpers for bytes;

    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('MORPHO_AAVE_V3_CLAIMER');

    /**
     * @dev Morpho-Aave V3 claim config. Only used in the initializer.
     */
    struct MorphoAaveV3ClaimConfig {
        BaseMorphoAaveV3Config baseMorphoAaveV3Config;
    }

    /**
     * @dev Initializes a Morpho-Aave V3 claimer
     * @param config Morpho-Aave V3 claim config
     */
    function initialize(MorphoAaveV3ClaimConfig memory config) external virtual initializer {
        __MorphoAaveV3Claimer_init(config);
    }

    /**
     * @dev Initializes the Morpho-Aave V3 claimer. It does call upper contracts initializers.
     * @param config Morpho-Aave V3 claim config
     */
    function __MorphoAaveV3Claimer_init(MorphoAaveV3ClaimConfig memory config) internal onlyInitializing {
        __BaseMorphoAaveV3Task_init(config.baseMorphoAaveV3Config);
        __MorphoAaveV3Claimer_init_unchained(config);
    }

    /**
     * @dev Initializes the Morpho-Aave V3 claimer. It does not call upper contracts initializers.
     * @param config Morpho-Aave V3 claim config
     */
    function __MorphoAaveV3Claimer_init_unchained(MorphoAaveV3ClaimConfig memory config) internal onlyInitializing {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Executes the Morpho-Aave V3 claimer task
     * @param amount Amount of Morpho-Aave V3 pool tokens to be claimed
     * @param proof Merkle proof of the Morpho rewards
     */
    function call(address token, uint256 amount, bytes32[] calldata proof)
        external
        override
        authP(authParams(token, amount))
    {
        if (amount == 0) amount = getTaskAmount(token);
        _beforeMorphoAaveV3Claimer(token, amount, proof);
        bytes memory connectorData = abi.encodeWithSelector(IMorphoAaveV3Connector.claim.selector, amount, proof);
        bytes memory result = ISmartVault(smartVault).execute(connector, connectorData);
        (address[] memory tokens, uint256[] memory amounts) = abi.decode(result, (address[], uint256[]));
        _afterMorphoAaveV3Claimer(token, amount, tokens, amounts);
    }

    /**
     * @dev Before Morpho-Aave V3 claimer hook
     */
    function _beforeMorphoAaveV3Claimer(address token, uint256 amount, bytes32[] calldata proof) internal virtual {
        _beforeBaseMorphoAaveV3Task(token, amount);
        bytes memory connectorData = abi.encodeWithSelector(IMorphoAaveV3Connector.morphoToken.selector);
        bytes memory result = ISmartVault(smartVault).execute(connector, connectorData);
        if (token != abi.decode(result, (address))) revert TaskTokenNotMorpho();
        if (proof.length == 0) revert TaskProofEmpty();
    }

    /**
     * @dev After Morpho-Aave V3 claimer hook
     */
    function _afterMorphoAaveV3Claimer(
        address tokenIn,
        uint256 amountIn,
        address[] memory tokensOut,
        uint256[] memory amountsOut
    ) internal virtual {
        if (tokensOut.length != amountsOut.length) revert TaskClaimResultLengthMismatch();
        for (uint256 i = 0; i < tokensOut.length; i++) _increaseBalanceConnector(tokensOut[i], amountsOut[i]);
        _afterBaseMorphoAaveV3Task(tokenIn, amountIn);
    }
}
