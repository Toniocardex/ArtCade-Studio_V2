add_library(artcade-presentation
    src/output_policy.cpp
    src/surface_metrics.cpp
    src/coordinate_mapper.cpp
    src/view_controller.cpp
    src/camera_compose.cpp
    src/presentation_snapshot.cpp
    src/presentation_system.cpp
    src/presentation_bindings.cpp
)
target_include_directories(artcade-presentation
    PUBLIC include
    PRIVATE src
)
target_link_libraries(artcade-presentation
    PUBLIC artcade-core
)
