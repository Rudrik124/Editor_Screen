from dataclasses import dataclass, field
from typing import List, Dict, Optional, Literal

@dataclass
class FilterStream:
    """Represents a named stream in the FFmpeg filter graph (e.g. [v_norm_0])."""
    name: str
    stream_type: Literal["video", "audio"]
    start_time: float = 0.0
    duration: float = 0.0

@dataclass
class FilterNode:
    """Represents a single filter operation in a complex filter chain."""
    filter_name: str
    inputs: List[str]
    outputs: List[str]
    args: Dict[str, str] = field(default_factory=dict)

    def to_filter_string(self) -> str:
        """Formats into FFmpeg filter syntax: [in1][in2]name=k1=v1:k2=v2[out1]"""
        in_str = "".join(f"[{i}]" for i in self.inputs)
        out_str = "".join(f"[{o}]" for o in self.outputs)
        args_str = ":".join(f"{k}={v}" if v is not None else str(k) for k, v in self.args.items())
        if args_str:
            return f"{in_str}{self.filter_name}={args_str}{out_str}"
        return f"{in_str}{self.filter_name}{out_str}"

@dataclass
class CompilationContext:
    """Context state tracking input media files, stream labels, and target resolution."""
    width: int = 1920
    height: int = 1080
    fps: int = 30
    quality: str = "standard"
    total_duration: float = 0.0
    
    # Input files map: file_path -> input_index
    input_files: Dict[str, int] = field(default_factory=dict)
    
    # Filter graph nodes
    filter_nodes: List[FilterNode] = field(default_factory=list)
    _label_counter: int = 0

    def register_input_file(self, file_path: str) -> int:
        if file_path not in self.input_files:
            idx = len(self.input_files)
            self.input_files[file_path] = idx
        return self.input_files[file_path]

    def generate_label(self, prefix: str = "s") -> str:
        self._label_counter += 1
        return f"{prefix}_{self._label_counter}"

    def add_node(self, node: FilterNode) -> None:
        self.filter_nodes.append(node)

    def build_filter_complex_string(self) -> str:
        return ";\n".join(node.to_filter_string() for node in self.filter_nodes)
