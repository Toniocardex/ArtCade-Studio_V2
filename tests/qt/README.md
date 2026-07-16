# Qt editor smoke notes

Build with `-DARTCADE_BUILD_QT_EDITOR=ON`, then:

```powershell
cmake --build <build-dir> --target artcade-qmllint
cmake --build <build-dir> --target artcade-editor-qt
```

Automated Quick Test suites land in a later milestone; Week 1 wires tooling targets only.
