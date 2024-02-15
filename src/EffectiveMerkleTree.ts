import { Field, MerkleTree, Poseidon, Provable, assert } from 'o1js';

export type MerkleNodesMap = {
  [level: number]: {
    [nodes: string]: Field;
  };
};

export type MerkleNode = {
  level: number;
  index: bigint;
  digest: Field;
};

export class EffectiveMerkleTree {
  private height: number;
  private nodes: MerkleNodesMap;
  protected zeroes: Field[];

  constructor(height: number) {
    this.height = height;
    this.nodes = {};
    this.zeroes = new Array(height);
    this.zeroes[0] = Field(0);
    for (let i = 1; i < height; i += 1) {
      this.zeroes[i] = Poseidon.hash([this.zeroes[i - 1], this.zeroes[i - 1]]);
    }
  }

  public getRoot() {
    return this.getNode(this.height - 1, 0n);
  }

  public setLeaves(leaves: MerkleNode[]) {
    const sortedLeaves = leaves.sort((a, b) => Number(a.index - b.index));
    const resultedNode = this.constructTree(
      sortedLeaves,
      0,
      sortedLeaves.length - 1
    );

    let currIndex = resultedNode.index;

    for (let level = resultedNode.level; level < this.height; level += 1) {
      currIndex /= 2n;
      const left = this.getNode(level - 1, currIndex * 2n);
      const right = this.getNode(level - 1, currIndex * 2n + 1n);
      this.setNode({
        level,
        index: currIndex,
        digest: Poseidon.hash([left, right]),
      });
    }
  }

  private constructTree(
    leaves: MerkleNode[],
    leftPosition: number,
    rightPosition: number
  ): MerkleNode {
    if (leftPosition === rightPosition) {
      return leaves[leftPosition];
    }

    const median = Math.floor((leftPosition + rightPosition) / 2);

    let leftNode = this.constructTree(leaves, leftPosition, median);
    let rightNode = this.constructTree(leaves, median + 1, rightPosition);

    
    this.setNode(leftNode);
    this.setNode(rightNode);


    if (leftNode.level > rightNode.level) {
      let currIndex = rightNode.index;
      for (
        let level = rightNode.level + 1;
        level <= leftNode.level;
        level += 1
      ) {
        currIndex /= 2n;
        rightNode = this.updateNode(level, currIndex);
      }
      this.setNode(rightNode);
    } else if (leftNode.level < rightNode.level) {
      let currIndex = leftNode.index;
      for (
        let level = leftNode.level + 1;
        level <= rightNode.level;
        level += 1
      ) {
        currIndex /= 2n;
        leftNode = this.updateNode(level, currIndex);
      }
      this.setNode(leftNode);
    }
    
    assert(leftNode.level === rightNode.level);

    const intersectionLevel = this.findIntersectionLevel(
      leftNode.index,
      rightNode.index
    );

    let oneIndex = rightNode.index;
    let otherIndex = leftNode.index;

    let lastOneInsertedNode: MerkleNode = rightNode;
    let lastOtherInsertedNode: MerkleNode = leftNode;

    for (
      let level = rightNode.level + 1;
      level < intersectionLevel;
      level += 1
    ) {
      oneIndex /= 2n;
      otherIndex /= 2n;
      // one
      let left = this.getNode(level - 1, oneIndex * 2n);
      let right = this.getNode(level - 1, oneIndex * 2n + 1n);
      lastOneInsertedNode = {
        level,
        index: oneIndex,
        digest: Poseidon.hash([left, right]),
      };

      // Provable.log('lastOneInsertedNode', lastOneInsertedNode);
      this.setNode(lastOneInsertedNode);

      // other
      left = this.getNode(level - 1, otherIndex * 2n);
      right = this.getNode(level - 1, otherIndex * 2n + 1n);
      lastOtherInsertedNode = {
        level,
        index: otherIndex,
        digest: Poseidon.hash([left, right]),
      };
      // Provable.log('lastOtherInsertedNode', lastOtherInsertedNode);
      this.setNode(lastOtherInsertedNode);
    }


    const intersectionDigest = Poseidon.hash([
      leftNode.digest,
      rightNode.digest,
    ]);
    
    const levelDifference = intersectionLevel - leftNode.level;
    const intersectionIndex = oneIndex >> BigInt(levelDifference);

    return {
      level: intersectionLevel,
      index: intersectionIndex,
      digest: intersectionDigest,
    };
  }

  private updateNode(level: number, index: bigint): MerkleNode {
    const left = this.getNode(level - 1, index * 2n);
    const right = this.getNode(level - 1, index * 2n + 1n);
    const node = {
      level,
      index,
      digest: Poseidon.hash([left, right]),
    };
    this.setNode(node);
    return node;
  }

  // private constructTree(
  //   leaves: MerkleNode[],
  //   leftPosition: number,
  //   rightPosition: number
  // ): MerkleNode {
  //   if (leftPosition === rightPosition) {
  //     return leaves[leftPosition];
  //   }

  //   const median = Math.floor((leftPosition + rightPosition) / 2);

  //   let oneAdjacentNode = this.constructTree(leaves, leftPosition, median);
  //   let otherAdjacentNode = this.constructTree(
  //     leaves,
  //     median + 1,
  //     rightPosition
  //   );

  //   if (oneAdjacentNode.index > otherAdjacentNode.index) {
  //     let currIndex = otherAdjacentNode.index;
  //     for (
  //       let level = otherAdjacentNode.level;
  //       level <= oneAdjacentNode.level;
  //       level += 1
  //     ) {
  //       const left = this.getNode(level - 1, currIndex * 2n);
  //       const right = this.getNode(level - 1, currIndex * 2n + 1n);
  //       otherAdjacentNode = {
  //         level,
  //         index: currIndex,
  //         digest: Poseidon.hash([left, right]),
  //       };
  //       this.setNode(otherAdjacentNode);
  //     }
  //   } else if (oneAdjacentNode.index <= otherAdjacentNode.index) {
  //     let currIndex = oneAdjacentNode.index;
  //     for (
  //       let level = oneAdjacentNode.level;
  //       level < otherAdjacentNode.level;
  //       level += 1
  //     ) {
  //       const left = this.getNode(level - 1, currIndex * 2n);
  //       const right = this.getNode(level - 1, currIndex * 2n + 1n);
  //       oneAdjacentNode = {
  //         level,
  //         index: currIndex,
  //         digest: Poseidon.hash([left, right]),
  //       };
  //       this.setNode(oneAdjacentNode);
  //     }
  //   }

  //   assert(oneAdjacentNode.level === otherAdjacentNode.level);

  //   this.setNode(oneAdjacentNode);
  //   this.setNode(otherAdjacentNode);

  //   const intersectionLevel = this.findIntersectionLevel(
  //     oneAdjacentNode.index,
  //     otherAdjacentNode.index
  //   );

  //   // console.log('intersectionLevel', intersectionLevel);

  //   let oneIndex = oneAdjacentNode.index;
  //   let otherIndex = otherAdjacentNode.index;

  //   let lastOneInsertedNode: MerkleNode = oneAdjacentNode;
  //   let lastOtherInsertedNode: MerkleNode = otherAdjacentNode;

  //   for (
  //     let level = oneAdjacentNode.level + 1;
  //     level < intersectionLevel;
  //     level += 1
  //   ) {
  //     oneIndex /= 2n;
  //     otherIndex /= 2n;
  //     // one
  //     let left = this.getNode(level - 1, oneIndex * 2n);
  //     let right = this.getNode(level - 1, oneIndex * 2n + 1n);
  //     lastOneInsertedNode = {
  //       level,
  //       index: oneIndex,
  //       digest: Poseidon.hash([left, right]),
  //     };

  //     // Provable.log('lastOneInsertedNode', lastOneInsertedNode);
  //     this.setNode(lastOneInsertedNode);

  //     // other
  //     left = this.getNode(level - 1, otherIndex * 2n);
  //     right = this.getNode(level - 1, otherIndex * 2n + 1n);
  //     lastOtherInsertedNode = {
  //       level,
  //       index: otherIndex,
  //       digest: Poseidon.hash([left, right]),
  //     };
  //     // Provable.log('lastOtherInsertedNode', lastOtherInsertedNode);
  //     this.setNode(lastOtherInsertedNode);
  //   }

  //   const intersectionDigest = Poseidon.hash([
  //     lastOneInsertedNode.digest,
  //     lastOtherInsertedNode.digest,
  //   ]);
  //   const levelDifference = intersectionLevel - oneAdjacentNode.level;
  //   const intersectionIndex = oneIndex >> BigInt(levelDifference);

  //   return {
  //     level: intersectionLevel,
  //     index: intersectionIndex,
  //     digest: intersectionDigest,
  //   };
  // }

  public findIntersectionLevel(index1: bigint, index2: bigint): number {
    const highestDifferingBit = index1 ^ index2;
    return highestDifferingBit.toString(2).length;
  }

  public getNode(level: number, index: bigint): Field {
    return this.nodes[level]?.[index.toString()] ?? this.zeroes[level];
  }

  public setNode(node: MerkleNode) {
    (this.nodes[node.level] ??= {})[node.index.toString()] = node.digest;
  }

  public printTree() {
    Provable.log('printTree', this.nodes);
  }
}
